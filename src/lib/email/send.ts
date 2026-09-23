import "server-only";

/**
 * Envio de e-mail pela API do Resend (sem SDK). Interface pensada para ganhar
 * outros canais depois (WhatsApp) sem mudar quem chama.
 */
export type NotificationChannel = {
  send: (
    to: string,
    subject: string,
    html: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export const emailChannel: NotificationChannel = {
  async send(to, subject, html) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, error: "RESEND_API_KEY não configurada" };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Almox SST <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  },
};
