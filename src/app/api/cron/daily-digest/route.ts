import { createHash, timingSafeEqual } from "node:crypto";
import { createElement } from "react";
import { render } from "@react-email/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/url";
import { describeDue, todayInSaoPaulo } from "@/lib/format";
import { emailChannel } from "@/lib/email/send";
import { ISSUE_LABELS } from "@/features/trainings/constants";
import {
  buildDigest,
  DEFAULT_ALERT_SETTINGS,
  digestSubject,
  newIrregulars,
  type AlertSettings,
} from "@/features/alerts/digest";
import { DailyDigest } from "@/emails/DailyDigest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type Pendencia = { tipo: string; severidade: string; item: string };

/**
 * Resumo diário (Vercel Cron, 10:00 UTC = 07:00 em São Paulo). Idempotente:
 * notification_log impede dois envios no mesmo dia; não envia se o conteúdo
 * for igual ao último enviado. Respeita Configurações → Alertas. Uma
 * organização com erro não derruba as outras.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Não autorizado", { status: 401 });
  const admin = createAdminClient();
  const today = todayInSaoPaulo();
  const summary = { organizations: 0, sent: 0, skipped: 0, errors: 0 };
  console.info("[daily-digest] início", { today });

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, slug");
  if (error) {
    console.error("[daily-digest] falha ao listar organizações", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }

  for (const org of orgs ?? []) {
    summary.organizations += 1;
    try {
      const [{ data: settingsRow }, { data: alerts }, { data: compliance }] =
        await Promise.all([
          admin
            .from("alert_settings")
            .select(
              "enabled, notify_new_irregulars, notify_ca, notify_replacements, notify_trainings, notify_stock, notify_signatures",
            )
            .eq("organization_id", org.id)
            .maybeSingle(),
          admin
            .from("v_alerts")
            .select("alert_key, kind, severity, due_date, title")
            .eq("organization_id", org.id)
            .in("severity", ["critico", "atencao"]),
          admin.rpc("fn_conformidade_funcionarios", { p_org: org.id }),
        ]);
      const settings: AlertSettings = settingsRow ?? DEFAULT_ALERT_SETTINGS;

      // Foto de hoje dos irregulares; "novos" = não estavam na última foto.
      const irregularToday = (compliance ?? [])
        .filter((r) => r.status === "irregular")
        .map((r) => {
          const first = ((r.pendencias ?? []) as unknown as Pendencia[]).find(
            (p) => p.severidade === "irregular",
          );
          return {
            employeeId: r.employee_id,
            name: r.employee_name,
            reason: first
              ? `${ISSUE_LABELS[first.tipo] ?? first.tipo}: ${first.item}`
              : "Pendência de conformidade",
          };
        });
      const { data: previous } = await admin
        .from("compliance_snapshots")
        .select("irregular_employee_ids")
        .eq("organization_id", org.id)
        .lt("taken_on", today)
        .order("taken_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      await admin.from("compliance_snapshots").upsert({
        organization_id: org.id,
        taken_on: today,
        irregular_employee_ids: irregularToday.map((e) => e.employeeId),
      });

      const digest = buildDigest(
        alerts ?? [],
        settings,
        newIrregulars(irregularToday, previous?.irregular_employee_ids ?? null),
        describeDue,
      );
      if (!digest) {
        summary.skipped += 1;
        continue;
      }
      const payloadHash = createHash("sha256")
        .update(digest.contentKeys.join("|"))
        .digest("hex");

      const html = await render(
        createElement(DailyDigest, {
          orgName: org.name,
          criticalCount: digest.criticalCount,
          attentionCount: digest.attentionCount,
          sections: digest.sections,
          alertsUrl: `${getSiteUrl()}/${org.slug}/dashboard`,
          settingsUrl: `${getSiteUrl()}/${org.slug}/configuracoes?aba=alertas`,
        }),
      );
      const subject = digestSubject(
        org.name,
        digest.criticalCount,
        digest.attentionCount,
      );

      const { data: recipients } = await admin.rpc("digest_recipients", {
        p_org: org.id,
      });
      for (const r of recipients ?? []) {
        const { data: last } = await admin
          .from("notification_log")
          .select("sent_on, payload_hash")
          .eq("organization_id", org.id)
          .eq("user_id", r.user_id)
          .eq("kind", "daily_digest")
          .order("sent_on", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (
          last &&
          (last.sent_on === today || last.payload_hash === payloadHash)
        ) {
          summary.skipped += 1;
          continue;
        }
        const result = await emailChannel.send(r.email, subject, html);
        if (!result.ok) {
          summary.errors += 1;
          console.error("[daily-digest] envio falhou", {
            org: org.id,
            error: result.error,
          });
          continue;
        }
        await admin.from("notification_log").insert({
          organization_id: org.id,
          user_id: r.user_id,
          kind: "daily_digest",
          payload_hash: payloadHash,
        });
        summary.sent += 1;
      }
    } catch (e) {
      summary.errors += 1;
      console.error("[daily-digest] erro na organização", {
        org: org.id,
        error: (e as Error).message,
      });
    }
  }

  console.info("[daily-digest] fim", summary);
  return Response.json({ ok: true, ...summary });
}
