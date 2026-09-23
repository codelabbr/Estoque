export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Garante que um destino de redirecionamento (ex.: `?next=`) é um caminho
 * interno do app. Bloqueia URLs absolutas e caminhos como `//site.com` ou
 * `/\site.com`, que o navegador interpreta como outro domínio (open redirect).
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
