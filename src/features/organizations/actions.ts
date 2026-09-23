"use server";

import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";
import type { ActionResult } from "@/lib/actions";
import { createOrganizationSchema } from "./schemas";

export async function createOrganization(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const cnpj = parsed.data.cnpj
    ? parsed.data.cnpj.replace(/\D/g, "")
    : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_cnpj: cnpj,
  });

  if (error) {
    const message = error.message.includes("organizations_slug_key")
      ? "Este identificador já está em uso. Escolha outro."
      : mapDbError(error);
    return { ok: false, error: message };
  }

  return { ok: true, data: { slug: data!.slug } };
}
