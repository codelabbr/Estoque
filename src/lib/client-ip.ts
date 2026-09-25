import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";

/** IP de quem fez a requisição (primeiro do x-forwarded-for), ou undefined se inválido. */
export async function getClientIp(): Promise<string | undefined> {
  const h = await headers();
  const forwarded =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "";
  return isIP(forwarded) ? forwarded : undefined;
}
