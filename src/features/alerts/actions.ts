"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { addDaysToDate, todayInSaoPaulo } from "@/lib/format";
import { PERMISSION_DENIED, type ActionResult } from "@/lib/actions";

async function setState(
  orgSlug: string,
  alertKey: string,
  state: { status: "adiado" | "resolvido"; snoozedUntil?: string },
) {
  const ctx = await getOrgContext(orgSlug);
  if (!canManageRegistry(ctx.role)) return PERMISSION_DENIED;
  if (!/^[a-z_]+:[0-9a-f-]{36}(:[0-9a-z:-]+)?$/.test(alertKey))
    return { ok: false as const, error: "Alerta inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("alert_states").upsert({
    organization_id: ctx.org.id,
    alert_key: alertKey,
    status: state.status,
    snoozed_until: state.snoozedUntil ?? null,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}`, "layout");
  return { ok: true as const, data: undefined };
}

export async function snoozeAlert(
  orgSlug: string,
  alertKey: string,
  days = 7,
): Promise<ActionResult> {
  return setState(orgSlug, alertKey, {
    status: "adiado",
    snoozedUntil: addDaysToDate(todayInSaoPaulo(), days),
  });
}

export async function resolveAlert(
  orgSlug: string,
  alertKey: string,
): Promise<ActionResult> {
  return setState(orgSlug, alertKey, { status: "resolvido" });
}

export async function setMyDailyDigest(
  orgSlug: string,
  enabled: boolean,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_daily_digest", {
    p_org: ctx.org.id,
    p_enabled: enabled,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/alertas`);
  return { ok: true, data: undefined };
}
