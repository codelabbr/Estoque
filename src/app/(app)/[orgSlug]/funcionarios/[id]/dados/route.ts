import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Exportação LGPD dos dados de um funcionário (JSON), para atender o titular via empresa. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  const { orgSlug, id } = await params;
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role))
    return new Response("Sem permissão", { status: 403 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_employee_data", {
    p_employee: id,
  });
  if (error || !data)
    return new Response("Funcionário não encontrado", { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dados-funcionario-${id}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
