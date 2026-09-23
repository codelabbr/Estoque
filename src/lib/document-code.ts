import { createHash } from "node:crypto";

/** Código de verificação: sha256 de (tipo, org, parâmetros, emissão) → 12 primeiros caracteres. */
export function documentCode(
  type: string,
  orgId: string,
  params: Record<string, unknown>,
  emittedAt: string,
) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ type, orgId, params, emittedAt }))
    .digest("hex");
  return { hash, code: hash.slice(0, 12).toUpperCase() };
}
