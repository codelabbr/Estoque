import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { formatDateTime } from "@/lib/format";
import { documentCode } from "@/lib/document-code";
import { csvResponse, toCsv } from "@/lib/csv";
import { REPORTS } from "@/features/reports/definitions";
import { ReportTable } from "@/pdf/ReportTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /relatorios/<nome>.<csv|pdf>?parametros */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; arquivo: string }> },
) {
  const { orgSlug, arquivo } = await params;
  const match = /^([a-z-]+)\.(csv|pdf)$/.exec(arquivo);
  const report = match ? REPORTS[match[1]] : undefined;
  if (
    !match ||
    !report ||
    !report.formats.includes(match[2] as "csv" | "pdf")
  ) {
    return new Response("Relatório não encontrado", { status: 404 });
  }
  const [, name, format] = match;
  const { org, user } = await getOrgContext(orgSlug);
  const searchParams = new URL(req.url).searchParams;
  const data = await report.build(org.id, searchParams);
  const today = new Date().toISOString().slice(0, 10);

  const emittedAtIso = new Date().toISOString();
  const { hash, code } = documentCode(
    name,
    org.id,
    Object.fromEntries(searchParams),
    emittedAtIso,
  );
  const supabase = await createClient();
  await supabase.from("document_log").insert({
    organization_id: org.id,
    type: `${name}.${format}`,
    params: Object.fromEntries(searchParams),
    hash,
  });

  if (format === "csv") {
    const csv = toCsv(
      data.rows,
      data.columns.map((c, i) => ({
        header: c.header,
        value: (row: (string | number | null)[]) => row[i],
      })),
    );
    return csvResponse(csv, `${name}-${today}.csv`);
  }

  const pdf = await renderToBuffer(
    createElement(ReportTable, {
      data: {
        org: { name: org.name, legalName: org.legal_name, cnpj: org.cnpj },
        title: data.title,
        subtitle: data.subtitle,
        landscape: data.landscape,
        columns: data.columns,
        rows: data.rows.map((r) => r.map((v) => (v === null ? "" : String(v)))),
        summary: data.summary,
        emittedAt: formatDateTime(emittedAtIso),
        emittedBy: user.email,
        code,
      },
    }) as Parameters<typeof renderToBuffer>[0],
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}-${today}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
