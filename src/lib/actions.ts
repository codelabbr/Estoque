import type { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Resultado padrão para falha de validação Zod. */
export function invalid(error: ZodError): {
  ok: false;
  error: string;
  fieldErrors: Record<string, string[]>;
} {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "Verifique os campos destacados.", fieldErrors };
}

export const PERMISSION_DENIED = {
  ok: false as const,
  error: "Você não tem permissão para fazer isso.",
};

/** Converte string vazia em null (inputs opcionais de formulário). */
export function emptyToNull<T>(value: T | "" | undefined | null): T | null {
  return value === "" || value === undefined ? null : value;
}
