/**
 * Gera src/lib/supabase/database.types.ts a partir das migrations, sem Docker:
 * aplica tudo num PGlite (supabase/tests/harness.ts) e lê o catálogo do Postgres.
 * Formato compatível com `supabase gen types typescript`.
 *
 * Uso: pnpm db:types
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createTestDb } from "../supabase/tests/harness.ts";

const OUT = "src/lib/supabase/database.types.ts";
const db = await createTestDb();

type Col = {
  table_name: string;
  column_name: string;
  udt_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
  identity_generation: string | null;
  is_generated: "ALWAYS" | "NEVER";
  ordinal_position: number;
};

const enums = (
  await db.query<{ name: string; labels: string[] }>(`
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by t.typname`)
).rows;
const enumNames = new Set(enums.map((e) => e.name));

const relations = (
  await db.query<{ name: string; kind: string }>(`
    select c.relname as name, c.relkind as kind from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
    order by c.relname`)
).rows;

const columns = (
  await db.query<Col>(`
    select table_name, column_name, udt_name, data_type, is_nullable, column_default,
           is_identity, identity_generation, is_generated, ordinal_position
    from information_schema.columns where table_schema = 'public'
    order by table_name, column_name`)
).rows;

const fks = (
  await db.query<{
    name: string;
    table: string;
    cols: string[];
    ref_table: string;
    ref_cols: string[];
    one_to_one: boolean;
  }>(`
    select con.conname as name, rel.relname as table,
      array(select a.attname from unnest(con.conkey) with ordinality k(n, i)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.i) as cols,
      ref.relname as ref_table,
      array(select a.attname from unnest(con.confkey) with ordinality k(n, i)
            join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.i) as ref_cols,
      exists (
        select 1 from pg_index ix where ix.indrelid = con.conrelid and ix.indisunique
          and (select array_agg(x order by x) from unnest(ix.indkey::int2[]) x)
            = (select array_agg(x order by x) from unnest(con.conkey) x)
      ) as one_to_one
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class ref on ref.oid = con.confrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_namespace rn on rn.oid = ref.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
    order by con.conname`)
).rows;

const functions = (
  await db.query<{
    name: string;
    arg_names: string[] | null;
    arg_types: string[];
    arg_modes: string[] | null;
    n_defaults: number;
    ret_type: string;
    ret_type_kind: string;
    ret_set: boolean;
    ret_rel: string | null;
  }>(`
    select p.proname as name, p.proargnames as arg_names,
      array(select format_type(t, null) from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) t) as arg_types,
      p.proargmodes::text[] as arg_modes, p.pronargdefaults as n_defaults,
      format_type(p.prorettype, null) as ret_type, rt.typtype as ret_type_kind,
      p.proretset as ret_set,
      (select c.relname from pg_class c where c.oid = rt.typrelid and c.relkind in ('r','v','m')) as ret_rel
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public' and p.prokind = 'f'
      and format_type(p.prorettype, null) not in ('trigger', 'event_trigger')
    order by p.proname`)
).rows;

function tsType(pgType: string): string {
  const t = pgType.replace(/^_/, "").replace(/\[\]$/, "");
  const isArray = pgType.startsWith("_") || pgType.endsWith("[]");
  let base: string;
  if (enumNames.has(t)) base = `Database["public"]["Enums"]["${t}"]`;
  else if (["bool", "boolean"].includes(t)) base = "boolean";
  else if (
    [
      "int2", "int4", "int8", "float4", "float8", "numeric", "smallint",
      "integer", "bigint", "real", "double precision",
    ].includes(t)
  )
    base = "number";
  else if (["json", "jsonb"].includes(t)) base = "Json";
  else if (["void"].includes(t)) base = "undefined";
  else base = "string";
  return isArray ? `${base}[]` : base;
}

function rowOf(table: string, view: boolean) {
  const cols = columns.filter((c) => c.table_name === table);
  const row = cols.map(
    (c) =>
      `          ${c.column_name}: ${tsType(c.udt_name)}${c.is_nullable === "YES" || view ? " | null" : ""};`,
  );
  const insert = cols.map((c) => {
    const generated =
      c.is_generated === "ALWAYS" || c.identity_generation === "ALWAYS";
    const optional =
      generated ||
      c.is_nullable === "YES" ||
      c.column_default !== null ||
      c.is_identity === "YES" ||
      view;
    const type = generated
      ? "never"
      : `${tsType(c.udt_name)}${c.is_nullable === "YES" || view ? " | null" : ""}`;
    return `          ${c.column_name}${optional ? "?" : ""}: ${type};`;
  });
  const update = cols.map((c) => {
    const generated =
      c.is_generated === "ALWAYS" || c.identity_generation === "ALWAYS";
    const type = generated
      ? "never"
      : `${tsType(c.udt_name)}${c.is_nullable === "YES" || view ? " | null" : ""}`;
    return `          ${c.column_name}?: ${type};`;
  });
  return { row, insert, update };
}

function relationshipsOf(table: string) {
  const list = fks.filter((f) => f.table === table);
  if (list.length === 0) return "[]";
  return `[\n${list
    .map(
      (f) => `          {
            foreignKeyName: "${f.name}";
            columns: [${f.cols.map((c) => `"${c}"`).join(", ")}];
            isOneToOne: ${f.one_to_one};
            referencedRelation: "${f.ref_table}";
            referencedColumns: [${f.ref_cols.map((c) => `"${c}"`).join(", ")}];
          },`,
    )
    .join("\n")}\n        ]`;
}

const tablesTs = relations
  .filter((r) => r.kind === "r")
  .map((r) => {
    const { row, insert, update } = rowOf(r.name, false);
    return `      ${r.name}: {
        Row: {
${row.join("\n")}
        };
        Insert: {
${insert.join("\n")}
        };
        Update: {
${update.join("\n")}
        };
        Relationships: ${relationshipsOf(r.name)};
      };`;
  })
  .join("\n");

const viewsTs = relations
  .filter((r) => r.kind !== "r")
  .map((r) => {
    const { row } = rowOf(r.name, true);
    return `      ${r.name}: {
        Row: {
${row.join("\n")}
        };
        Relationships: [];
      };`;
  })
  .join("\n");

function functionTs(f: (typeof functions)[number]) {
  const names = f.arg_names ?? [];
  const modes = f.arg_modes ?? f.arg_types.map(() => "i");
  const inArgs: { name: string; type: string }[] = [];
  const outCols: { name: string; type: string }[] = [];
  f.arg_types.forEach((type, i) => {
    const mode = modes[i];
    const name = names[i] ?? `arg${i}`;
    const udt = type.endsWith("[]") ? `_${type.slice(0, -2)}` : type;
    if (mode === "i" || mode === "b" || mode === "v") inArgs.push({ name, type: udt });
    if (mode === "o" || mode === "b" || mode === "t") outCols.push({ name, type: udt });
  });
  const firstDefault = inArgs.length - f.n_defaults;
  const args = inArgs.length
    ? `{\n${inArgs
        .map(
          (a, i) =>
            `          ${a.name}${i >= firstDefault ? "?" : ""}: ${tsType(a.type)};`,
        )
        .join("\n")}\n        }`
    : "never";
  let returns: string;
  let setof = "";
  if (outCols.length) {
    returns = `{\n${outCols.map((c) => `          ${c.name}: ${tsType(c.type)};`).join("\n")}\n        }[]`;
  } else if (f.ret_rel) {
    const { row } = rowOf(f.ret_rel, false);
    returns = `{\n${row.join("\n")}\n        }${f.ret_set ? "[]" : ""}`;
    setof = `
        SetofOptions: {
          from: "*";
          to: "${f.ret_rel}";
          isOneToOne: ${!f.ret_set};
          isSetofReturn: ${f.ret_set};
        };`;
  } else {
    const udt = f.ret_type.endsWith("[]") ? `_${f.ret_type.slice(0, -2)}` : f.ret_type;
    returns = `${tsType(udt)}${f.ret_set ? "[]" : ""}`;
  }
  return `      ${f.name}: {
        Args: ${args};
        Returns: ${returns};${setof}
      };`;
}

const enumsTs = enums
  .map((e) => `      ${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")};`)
  .join("\n");
const constantsEnums = enums
  .map((e) => `      ${e.name}: [${e.labels.map((l) => `"${l}"`).join(", ")}],`)
  .join("\n");

const helpers = `
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;
`;

const out = `// Gerado por scripts/gen-db-types.mts (pnpm db:types) — não edite à mão.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
${tablesTs}
    };
    Views: {
${viewsTs || "      [_ in never]: never;"}
    };
    Functions: {
${functions.map(functionTs).join("\n") || "      [_ in never]: never;"}
    };
    Enums: {
${enumsTs || "      [_ in never]: never;"}
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
${helpers}
export const Constants = {
  public: {
    Enums: {
${constantsEnums}
    },
  },
} as const;
`;

writeFileSync(OUT, out);
execFileSync("pnpm", ["exec", "prettier", "--write", OUT], { stdio: "ignore" });
await db.close();
console.log(`Tipos gerados em ${OUT}`);
