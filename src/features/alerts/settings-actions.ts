"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";

const alertSettingsSchema = z.object({
  enabled: z.boolean(),
  notify_new_irregulars: z.boolean(),
  notify_ca: z.boolean(),
  notify_replacements: z.boolean(),
  notify_trainings: z.boolean(),
  notify_stock: z.boolean(),
  notify_signatures: z.boolean(),
});

async function adminGuard(orgSlug: string) {
  const ctx = await getOrgContext(orgSlug);
  return isOrgAdmin(ctx.role) ? ctx : null;
}

/** Ativação do resumo diário e de cada tipo de alerta (owner/admin). */
export async function saveAlertSettings(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await adminGuard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = alertSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("alert_settings")
    .upsert({ organization_id: ctx.org.id, ...parsed.data });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

/** Liga/desliga o resumo diário de um membro (owner/admin). */
export async function setMemberDailyDigest(
  orgSlug: string,
  userId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const ctx = await adminGuard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  if (!z.uuid().safeParse(userId).success)
    return { ok: false, error: "Membro inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ daily_digest: enabled === true })
    .eq("organization_id", ctx.org.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  revalidatePath(`/${orgSlug}/alertas`);
  return { ok: true, data: undefined };
}
