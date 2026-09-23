import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "O identificador deve ter pelo menos 3 caracteres")
  .max(48, "O identificador deve ter no máximo 48 caracteres")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use apenas letras minúsculas, números e hífen",
  );

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa"),
  slug: slugSchema,
  cnpj: z.string().trim().optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = raw.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(cnpj[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

const alertDays = z.coerce
  .number({ error: "Informe os dias" })
  .int("Use um número inteiro")
  .min(1, "Mínimo 1 dia")
  .max(365, "Máximo 365 dias");

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(120),
  legalName: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v ? v : null)),
  cnpj: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine((v) => v === null || isValidCnpj(v), "CNPJ inválido"),
  responsibilityTerm: z
    .string()
    .trim()
    .min(50, "O termo precisa ter pelo menos 50 caracteres")
    .max(4000),
  alertDaysCa: alertDays,
  alertDaysEpi: alertDays,
  alertDaysTraining: alertDays,
});
