import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { todayInSaoPaulo } from "@/lib/format";
import type { EpiCategory } from "./constants";

export type EpiFilter = "ativos" | "ca_vencido" | "arquivados";

export async function listEpis(
  orgId: string,
  opts: { q?: string; filter: EpiFilter; category?: EpiCategory; page: number },
) {
  const supabase = await createClient();
  let query = supabase
    .from("epis")
    .select(
      "id, name, category, manufacturer, ca_number, ca_expires_at, lifespan_days, archived_at, epi_variants(id, size_label, archived_at)",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("name")
    .range((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE - 1);

  if (opts.filter === "arquivados")
    query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);
  if (opts.filter === "ca_vencido")
    query = query.lt("ca_expires_at", todayInSaoPaulo());
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.q) {
    const q = opts.q.replace(/[%,()]/g, " ");
    query = query.or(
      `name.ilike.%${q}%,ca_number.ilike.%${q}%,manufacturer.ilike.%${q}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return {
    rows: data.map((e) => ({
      ...e,
      sizes: e.epi_variants
        .filter((v) => !v.archived_at)
        .map((v) => v.size_label),
    })),
    total: count ?? 0,
  };
}

export async function getEpi(orgId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("epis")
    .select(
      "id, name, category, manufacturer, model, ca_number, ca_expires_at, unit_of_measure, lifespan_days, reference_cost, required_training_type_id, archived_at, created_at, epi_variants(id, size_label, sku, min_stock, archived_at)",
    )
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    epi_variants: [...data.epi_variants]
      .filter((v) => !v.archived_at)
      .sort((a, b) =>
        a.size_label.localeCompare(b.size_label, "pt-BR", { numeric: true }),
      ),
  };
}

/** Opções para selects (EPIs ativos com seus tamanhos). */
export async function listEpiOptions(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("epis")
    .select(
      "id, name, ca_number, ca_expires_at, lifespan_days, required_training_type_id, training_types(name), epi_variants(id, size_label, archived_at)",
    )
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data.map((e) => ({
    id: e.id,
    name: e.name,
    caNumber: e.ca_number,
    caExpiresAt: e.ca_expires_at,
    lifespanDays: e.lifespan_days,
    requiredTraining: e.required_training_type_id
      ? {
          id: e.required_training_type_id,
          name: e.training_types?.name ?? "Treinamento",
        }
      : null,
    variants: e.epi_variants
      .filter((v) => !v.archived_at)
      .sort((a, b) =>
        a.size_label.localeCompare(b.size_label, "pt-BR", { numeric: true }),
      )
      .map((v) => ({ id: v.id, sizeLabel: v.size_label })),
  }));
}
