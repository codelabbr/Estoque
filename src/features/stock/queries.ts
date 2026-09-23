import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/components/shared/pagination";
import type { StockMovementType } from "./constants";

export async function listLocations(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_locations")
    .select("id, name, is_default")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
}

/** Local escolhido na URL (?local=) ou o padrão. */
export async function resolveLocation(orgId: string, locationId?: string) {
  const locations = await listLocations(orgId);
  const current = locations.find((l) => l.id === locationId) ?? locations[0];
  return { locations, current };
}

export type PositionRow = {
  epiId: string;
  epiName: string;
  caNumber: string | null;
  unit: string;
  variants: {
    id: string;
    sizeLabel: string;
    minStock: number;
    balance: number;
    avgCost: number | null;
    lastEntryOn: string | null;
  }[];
};

/**
 * Posição de estoque de um local: parte das variações ativas (left join lógico)
 * para que itens sem movimento apareçam com saldo 0. O saldo vem da view.
 */
export async function getStockPosition(orgId: string, locationId: string) {
  const supabase = await createClient();
  const [variants, balances] = await Promise.all([
    supabase
      .from("epi_variants")
      .select(
        "id, size_label, min_stock, epis!inner(id, name, ca_number, unit_of_measure, archived_at)",
      )
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .is("epis.archived_at", null),
    supabase
      .from("v_stock_balance")
      .select("variant_id, balance, avg_cost, last_entry_on")
      .eq("organization_id", orgId)
      .eq("location_id", locationId),
  ]);
  if (variants.error) throw variants.error;
  if (balances.error) throw balances.error;

  const byVariant = new Map(
    (balances.data ?? []).map((b) => [b.variant_id, b]),
  );
  const byEpi = new Map<string, PositionRow>();
  for (const v of variants.data) {
    const epi = v.epis;
    const row =
      byEpi.get(epi.id) ??
      ({
        epiId: epi.id,
        epiName: epi.name,
        caNumber: epi.ca_number,
        unit: epi.unit_of_measure,
        variants: [],
      } as PositionRow);
    const b = byVariant.get(v.id);
    row.variants.push({
      id: v.id,
      sizeLabel: v.size_label,
      minStock: v.min_stock,
      balance: b?.balance ?? 0,
      avgCost: b?.avg_cost != null ? Number(b.avg_cost) : null,
      lastEntryOn: b?.last_entry_on ?? null,
    });
    byEpi.set(epi.id, row);
  }
  const rows = [...byEpi.values()].sort((x, y) =>
    x.epiName.localeCompare(y.epiName, "pt-BR"),
  );
  for (const r of rows) {
    r.variants.sort((x, y) =>
      x.sizeLabel.localeCompare(y.sizeLabel, "pt-BR", { numeric: true }),
    );
  }
  return rows;
}

export type MovementFilter = "todos" | "entradas" | "saidas" | "ajustes";

const FILTER_TYPES: Record<
  Exclude<MovementFilter, "todos">,
  StockMovementType[]
> = {
  entradas: ["entrada", "devolucao", "transferencia_entrada"],
  saidas: ["saida_entrega", "descarte", "transferencia_saida"],
  ajustes: ["ajuste_positivo", "ajuste_negativo", "estorno"],
};

export async function listMovements(
  orgId: string,
  opts: {
    locationId?: string;
    filter: MovementFilter;
    page: number;
    variantId?: string;
  },
) {
  const supabase = await createClient();
  let query = supabase
    .from("stock_movements")
    .select(
      "id, type, quantity, direction, signed_quantity, unit_cost, supplier, document_ref, reason, occurred_on, created_at, reverses_id, delivery_item_id, group_id, epi_variants(size_label, epis(id, name))",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE - 1);
  if (opts.locationId) query = query.eq("location_id", opts.locationId);
  if (opts.variantId) query = query.eq("variant_id", opts.variantId);
  if (opts.filter !== "todos")
    query = query.in("type", FILTER_TYPES[opts.filter]);

  const { data, count, error } = await query;
  if (error) throw error;

  // Quais movimentos da página já foram estornados.
  const ids = data.map((m) => m.id);
  const reversed = new Set<string>();
  if (ids.length) {
    const { data: rev } = await supabase
      .from("stock_movements")
      .select("reverses_id")
      .in("reverses_id", ids);
    for (const r of rev ?? []) if (r.reverses_id) reversed.add(r.reverses_id);
  }
  return {
    rows: data.map((m) => ({ ...m, isReversed: reversed.has(m.id) })),
    total: count ?? 0,
  };
}

/** Variações ativas com saldo no local, para o formulário de entrega/entrada. */
export async function getBalancesByVariant(orgId: string, locationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_stock_balance")
    .select("variant_id, balance")
    .eq("organization_id", orgId)
    .eq("location_id", locationId);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((b) => [b.variant_id!, b.balance ?? 0]),
  ) as Record<string, number>;
}
