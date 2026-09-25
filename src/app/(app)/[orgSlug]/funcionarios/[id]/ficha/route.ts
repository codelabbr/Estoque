import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatCpf } from "@/lib/validators";
import { documentCode } from "@/lib/document-code";
import { getEmployee } from "@/features/employees/queries";
import { REASON_LABELS } from "@/features/deliveries/constants";
import { byteaToDataUrl } from "@/features/deliveries/schemas";
import { EpiSheet, type EpiSheetData } from "@/pdf/EpiSheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  const { orgSlug, id } = await params;
  const { org, user } = await getOrgContext(orgSlug);
  const employee = await getEmployee(org.id, id);
  if (!employee) notFound();

  const supabase = await createClient();
  const { data: deliveries, error } = await supabase
    .from("epi_deliveries")
    .select(
      "id, delivered_at, signature_status, epi_delivery_items(epi_name_snapshot, size_label_snapshot, quantity, ca_number_snapshot, ca_expires_at_snapshot, reason, returned_at, ca_expired_override)",
    )
    .eq("organization_id", org.id)
    .eq("employee_id", id)
    .neq("signature_status", "cancelada")
    .order("delivered_at", { ascending: true });
  if (error) throw error;

  const signed = deliveries
    .filter((d) => d.signature_status === "assinada")
    .map((d) => d.id);
  const { data: signatures } = signed.length
    ? await supabase
        .from("signatures")
        .select("delivery_id, method, image_png, typed_name")
        .in("delivery_id", signed)
    : { data: [] };
  const sigByDelivery = new Map(
    (signatures ?? []).map((s) => [s.delivery_id, s]),
  );

  const emittedAtIso = new Date().toISOString();
  const { hash, code } = documentCode(
    "ficha_epi",
    org.id,
    { employeeId: id },
    emittedAtIso,
  );
  await supabase.from("document_log").insert({
    organization_id: org.id,
    type: "ficha_epi",
    params: { employee_id: id },
    hash,
  });

  const data: EpiSheetData = {
    org: { name: org.name, legalName: org.legal_name, cnpj: org.cnpj },
    employee: {
      name: employee.full_name,
      cpf: formatCpf(employee.cpf),
      registration: employee.registration,
      jobRole: employee.job_roles?.name ?? null,
      sector: employee.sectors?.name ?? null,
      hiredAt: employee.hired_at ? formatDate(employee.hired_at) : null,
    },
    term: org.responsibility_term,
    rows: deliveries.flatMap((d) => {
      const sig = sigByDelivery.get(d.id);
      const signature: EpiSheetData["rows"][number]["signature"] = sig
        ? sig.method === "desenho" && sig.image_png
          ? { kind: "imagem", dataUrl: byteaToDataUrl(sig.image_png) }
          : { kind: "nome", name: sig.typed_name ?? "" }
        : { kind: "pendente" };
      return d.epi_delivery_items.map((i) => ({
        date: formatDate(d.delivered_at),
        epi: i.epi_name_snapshot,
        size: i.size_label_snapshot,
        quantity: i.quantity,
        ca: i.ca_number_snapshot,
        caValidity: i.ca_expires_at_snapshot
          ? formatDate(i.ca_expires_at_snapshot)
          : null,
        reason: REASON_LABELS[i.reason],
        returnedAt: i.returned_at ? formatDate(i.returned_at) : null,
        signature,
        caOverride: i.ca_expired_override,
      }));
    }),
    emittedAt: formatDateTime(emittedAtIso),
    emittedBy: user.email,
    code,
  };

  const pdf = await renderToBuffer(
    createElement(EpiSheet, { data }) as Parameters<typeof renderToBuffer>[0],
  );
  const fileName = `ficha-epi-${employee.full_name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
