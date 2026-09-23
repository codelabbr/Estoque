import { z } from "zod";

export function isValidCpf(rawCpf: string): boolean {
  const cpf = rawCpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);

  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i] * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

export const cpfSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => isValidCpf(v), "CPF inválido");

export function formatCpf(digitsOnly: string): string {
  const cpf = digitsOnly.replace(/\D/g, "").padEnd(11, "_");
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

/** CPF parcialmente mascarado para listas e páginas públicas (LGPD): ***.456.789-** */
export function maskCpfPartial(digitsOnly: string): string {
  const cpf = digitsOnly.replace(/\D/g, "");
  if (cpf.length !== 11) return "***.***.***-**";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

export function formatPhone(digitsOnly: string): string {
  const d = digitsOnly.replace(/\D/g, "");
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitsOnly;
}
