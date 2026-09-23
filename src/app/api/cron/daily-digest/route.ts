import { createHash, timingSafeEqual } from "node:crypto";
import { createElement } from "react";
import { render } from "@react-email/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/url";
import { describeDue, todayInSaoPaulo } from "@/lib/format";
import { emailChannel } from "@/lib/email/send";
import {
  ALERT_KIND_LABELS,
  ALERT_GROUPS,
  type AlertKind,
} from "@/features/alerts/constants";
import { DailyDigest, type DigestSection } from "@/emails/DailyDigest";

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

/**
 * Resumo diário (Vercel Cron, 10:00 UTC = 07:00 em São Paulo). Idempotente:
 * notification_log impede dois envios no mesmo dia; não envia se o conjunto
 * de alertas for igual ao último enviado. Uma organização com erro não
 * derruba as outras.
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
      const { data: alerts } = await admin
        .from("v_alerts")
        .select("alert_key, kind, severity, due_date, title")
        .eq("organization_id", org.id)
        .in("severity", ["critico", "atencao"]);
      if (!alerts?.length) {
        summary.skipped += 1;
        continue;
      }
      const payloadHash = createHash("sha256")
        .update(
          alerts
            .map((a) => a.alert_key)
            .sort()
            .join("|"),
        )
        .digest("hex");

      const sections: DigestSection[] = ALERT_GROUPS.filter(
        (g) => g.kinds.length,
      )
        .map((g) => {
          const list = alerts
            .filter((a) => g.kinds.includes(a.kind as AlertKind))
            .sort(
              (a, b) =>
                (a.severity === "critico" ? -1 : 1) -
                (b.severity === "critico" ? -1 : 1),
            );
          return {
            label: g.label,
            total: list.length,
            items: list.slice(0, 10).map((a) => ({
              title: a.title ?? "",
              kindLabel: ALERT_KIND_LABELS[a.kind as AlertKind] ?? a.kind,
              due: a.due_date ? describeDue(a.due_date) : null,
              critical: a.severity === "critico",
            })),
          };
        })
        .filter((s) => s.total > 0);
      const critical = alerts.filter((a) => a.severity === "critico").length;
      const html = await render(
        createElement(DailyDigest, {
          orgName: org.name,
          criticalCount: critical,
          attentionCount: alerts.length - critical,
          sections,
          alertsUrl: `${getSiteUrl()}/${org.slug}/alertas`,
          settingsUrl: `${getSiteUrl()}/${org.slug}/alertas#resumo`,
        }),
      );
      const subject = critical
        ? `${critical} ${critical === 1 ? "item crítico" : "itens críticos"} hoje · ${org.name}`
        : `${alerts.length} ${alerts.length === 1 ? "item pede" : "itens pedem"} atenção · ${org.name}`;

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
