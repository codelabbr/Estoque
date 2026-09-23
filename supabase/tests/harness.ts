/**
 * Banco de teste sem Docker: Postgres real em WASM (PGlite) com um "stub" mínimo
 * do Supabase (schemas auth/storage, roles anon/authenticated/service_role e
 * auth.uid()). Aplica todas as migrations de supabase/migrations em ordem.
 *
 * Trechos que só existem no Supabase Cloud (pg_cron, pg_net) ficam entre
 * `-- @cloud-only begin` e `-- @cloud-only end` e são ignorados aqui.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create schema storage;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_super_admin boolean
);
grant select on auth.users to service_role;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  ), '')::uuid
$$;

create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id), name text, owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

function prepareMigration(sql: string): string {
  return sql
    .replace(/--\s*@cloud-only begin[\s\S]*?--\s*@cloud-only end/g, "")
    .replace(/^\s*create extension[^;]*;/gim, "");
}

export type TestDb = PGlite;

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(
        prepareMigration(readFileSync(join(MIGRATIONS_DIR, file), "utf8")),
      );
    } catch (error) {
      throw new Error(`Falha ao aplicar ${file}: ${(error as Error).message}`);
    }
  }
  return db;
}

export async function createUser(db: TestDb, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select tests.create_test_user($1) as id",
    [email],
  );
  return rows[0].id;
}

type Runner = Pick<Transaction, "query" | "exec">;

/** Executa `fn` numa transação autenticada como `userId` (RLS ativa). */
export async function asUser<T>(
  db: TestDb,
  userId: string,
  fn: (tx: Runner) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select tests.authenticate_as($1)", [userId]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

/** Executa `fn` como `anon` (sem usuário). */
export async function asAnon<T>(
  db: TestDb,
  fn: (tx: Runner) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return fn(tx);
  });
}

/** Executa `fn` como service_role (bypassa RLS), como o client admin. */
export async function asService<T>(
  db: TestDb,
  fn: (tx: Runner) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return fn(tx);
  });
}

/** Captura a mensagem de erro do Postgres (ou null se não houve erro). */
export async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/** Cria usuário + organização (como owner) e devolve os ids. */
export async function makeOrg(db: TestDb, slug: string) {
  const userId = await createUser(db, `${slug}@teste.almoxsst.dev`);
  const orgId = await asUser(db, userId, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      "select id from create_organization($1, $2)",
      [`Empresa ${slug}`, slug],
    );
    return rows[0].id;
  });
  return { userId, orgId };
}

/** Adiciona um usuário à organização com o papel dado. */
export async function addMember(
  db: TestDb,
  orgId: string,
  role: string,
  email: string,
): Promise<string> {
  const userId = await createUser(db, email);
  await db.query(
    "insert into organization_members (organization_id, user_id, role) values ($1, $2, $3)",
    [orgId, userId, role],
  );
  return userId;
}
