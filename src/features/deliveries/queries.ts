import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { byteaToDataUrl } from "./schemas";
import type { SignatureStatus } from "./constants";

export type DeliveryFilter = "todas" | "pendentes" | "assinadas" | "canceladas";
const FILTER_STATUS: Record<
  Exclude<DeliveryFilter, "todas">,
  SignatureStatus
> = {
  pendentes: "pendente",
  assinadas: "assinada",
  canceladas: "cancelada",
};

export async function listDeliveries(
  orgId: string,
  opts: {
    filter: DeliveryFilter;
    page: number;
    q?: string;
    employeeId?: string;
  },
) {
  const supabase = await createClient();
  let query = supabase
    .from("epi_deliveries")
    .select(
      "id, delivered_at, employee_id, employee_name_snapshot, signature_status, epi_delivery_items(epi_name_snapshot, size_label_snapshot, quantity)",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("delivered_at", { ascending: false })
    .range((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE - 1);
  if (opts.filter !== "todas")
    query = query.eq("signature_status", FILTER_STATUS[opts.filter]);
  if (opts.employeeId) query = query.eq("employee_id", opts.employeeId);
  if (opts.q)
    query = query.ilike(
      "employee_name_snapshot",
      `%${opts.q.replace(/[%,()]/g, " ")}%`,
    );
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function countPendingSignatures(orgId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("epi_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("signature_status", "pendente");
  return count ?? 0;
}

export async function getDelivery(orgId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("epi_deliveries")
    .select(
      "id, delivered_at, delivered_by, notes, employee_id, employee_name_snapshot, employee_cpf_snapshot, term_text, content_hash, signature_status, cancelled_at, cancel_reason, location_id, stock_locations(name), employees(id, phone, email, registration), epi_delivery_items(id, variant_id, quantity, reason, epi_name_snapshot, size_label_snapshot, ca_number_snapshot, ca_expires_at_snapshot, ca_expired_override, ca_override_reason, next_replacement_at, returned_at, return_destination, return_notes)",
    )
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [{ data: signature }, { data: request }] = await Promise.all([
    supabase
      .from("signatures")
      .select(
        "method, typed_name, image_png, signed_at, ip, user_agent, content_hash, evidence_hash",
      )
      .eq("delivery_id", id)
      .maybeSingle(),
    supabase
      .from("signature_requests")
      .select("channel, expires_at, created_at")
      .eq("delivery_id", id)
      .is("used_at", null)
      .is("cancelled_at", null)
      .neq("channel", "tela")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // null = assinatura anterior ao hash de evidência (Bloco A) ou sem assinatura.
  let evidenceValid: boolean | null = null;
  if (signature?.evidence_hash) {
    const { data: ok } = await supabase.rpc("verify_delivery_evidence", {
      p_delivery: id,
    });
    evidenceValid = ok === true;
  }

  return {
    ...data,
    evidenceValid,
    signature: signature
      ? {
          ...signature,
          imageDataUrl: signature.image_png
            ? byteaToDataUrl(signature.image_png)
            : null,
        }
      : null,
    openRequest: request,
  };
}

/** Itens em posse do funcionário, com status da próxima troca. */
export async function getEmployeeHoldings(orgId: string, employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_employee_epi_holdings")
    .select(
      "item_id, delivery_id, variant_id, epi_id, epi_name, size_label, quantity, ca_number_snapshot, delivered_at, signature_status, next_replacement_at, replacement_status",
    )
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId)
    .order("delivered_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Busca rápida do balcão: nome, CPF ou matrícula de funcionários ativos. */
export async function searchActiveEmployees(orgId: string, q: string) {
  const supabase = await createClient();
  const term = q.replace(/[%,()]/g, " ").trim();
  const digits = term.replace(/\D/g, "");
  const filters = [`full_name.ilike.%${term}%`, `registration.ilike.%${term}%`];
  if (digits.length >= 3) filters.push(`cpf.like.%${digits}%`);
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, cpf, registration, job_roles(name)")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .is("terminated_at", null)
    .or(filters.join(","))
    .order("full_name")
    .limit(12);
  if (error) throw error;
  return data;
}

/** Tudo que o balcão precisa para montar a entrega de um funcionário. */
export async function getCounterContext(orgId: string, employeeId: string) {
  const supabase = await createClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .select(
      "id, full_name, cpf, registration, phone, terminated_at, archived_at, job_role_id, job_roles(name), sectors(name)",
    )
    .eq("organization_id", orgId)
    .eq("id", employeeId)
    .maybeSingle();
  if (error) throw error;
  if (!employee) return null;

  const [requirements, holdings, lastItems] = await Promise.all([
    employee.job_role_id
      ? supabase
          .from("job_role_epi_requirements")
          .select("epi_id, quantity, mandatory")
          .eq("organization_id", orgId)
          .eq("job_role_id", employee.job_role_id)
      : Promise.resolve({
          data: [] as {
            epi_id: string;
            quantity: number;
            mandatory: boolean;
          }[],
        }),
    getEmployeeHoldings(orgId, employeeId),
    supabase
      .from("epi_delivery_items")
      .select(
        "variant_id, epi_deliveries!inner(employee_id, delivered_at, signature_status), epi_variants(epi_id)",
      )
      .eq("organization_id", orgId)
      .eq("epi_deliveries.employee_id", employeeId)
      .neq("epi_deliveries.signature_status", "cancelada")
      .order("id")
      .limit(200),
  ]);

  // Último tamanho entregue por EPI (para sugerir o mesmo).
  const lastSizeByEpi: Record<string, { variantId: string; at: string }> = {};
  const everDelivered = new Set<string>();
  for (const it of lastItems.data ?? []) {
    const epiId = it.epi_variants?.epi_id;
    if (!epiId) continue;
    everDelivered.add(epiId);
    const at = it.epi_deliveries.delivered_at;
    if (!lastSizeByEpi[epiId] || lastSizeByEpi[epiId].at < at)
      lastSizeByEpi[epiId] = { variantId: it.variant_id, at };
  }

  return {
    employee,
    requirements: requirements.data ?? [],
    holdings,
    lastVariantByEpi: Object.fromEntries(
      Object.entries(lastSizeByEpi).map(([k, v]) => [k, v.variantId]),
    ),
    everDeliveredEpiIds: [...everDelivered],
  };
}
