"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/client-ip";
import { mapDbError } from "@/lib/errors";
import { invalid, type ActionResult } from "@/lib/actions";
import { dataUrlToBytea, signatureSchema } from "./schemas";

/**
 * Assinatura pela página pública. O token do link é a autorização (uso único,
 * 72 h); o banco confere token, status e hash do conteúdo antes de gravar.
 */
export async function signByToken(
  token: string,
  input: unknown,
): Promise<ActionResult> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) {
    return { ok: false, error: "Link de assinatura inválido." };
  }
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const h = await headers();
  const ip = await getClientIp();

  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_delivery", {
    p_token: token,
    p_method: parsed.data.method,
    p_image_png:
      parsed.data.method === "desenho"
        ? dataUrlToBytea(parsed.data.imagePng)
        : undefined,
    p_typed_name:
      parsed.data.method === "nome_digitado"
        ? parsed.data.typedName
        : undefined,
    p_ip: ip,
    p_user_agent: h.get("user-agent") ?? undefined,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  return { ok: true, data: undefined };
}
