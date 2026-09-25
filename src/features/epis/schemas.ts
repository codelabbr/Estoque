import { z } from "zod";
import { EPI_CATEGORIES } from "./constants";

const optionalText = (max = 120) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida");

const optionalPositiveInt = (message: string) =>
  z
    .union([z.literal(""), z.coerce.number().int(message).positive(message)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

/** Aceita "12,50", "12.50" ou "1.234,56". */
const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = v.includes(",")
      ? v.replace(/\./g, "").replace(",", ".")
      : v;
    const n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

export const epiSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do EPI").max(120),
  category: z.enum(EPI_CATEGORIES, { error: "Selecione a categoria" }),
  manufacturer: optionalText(),
  model: optionalText(),
  caNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine(
      (v) => v === null || (v.length >= 3 && v.length <= 7),
      "CA deve ter de 3 a 7 dígitos",
    ),
  caExpiresAt: optionalDate,
  unitOfMeasure: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform((v) => v || "un"),
  lifespanDays: optionalPositiveInt("Informe um número de dias maior que zero"),
  referenceCost: optionalMoney,
  /** Treinamento exigido para receber o EPI (aviso na entrega). */
  requiredTrainingTypeId: z
    .union([z.literal(""), z.uuid("Seleção inválida")])
    .optional()
    .transform((v) => (v ? v : null)),
});

export const createEpiSchema = epiSchema.extend({
  sizes: z
    .string()
    .optional()
    .transform((v) =>
      Array.from(
        new Set(
          (v ?? "")
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    )
    .refine((list) => list.every((s) => s.length <= 20), "Tamanho muito longo"),
});

export const variantSchema = z.object({
  sizeLabel: z.string().trim().min(1, "Informe o tamanho").max(20),
  sku: optionalText(40),
  minStock: z.coerce
    .number({ error: "Informe o estoque mínimo" })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo")
    .max(100000),
});

export type EpiInput = z.input<typeof createEpiSchema>;

export function toDbEpi(data: z.output<typeof epiSchema>) {
  return {
    name: data.name,
    category: data.category,
    manufacturer: data.manufacturer,
    model: data.model,
    ca_number: data.caNumber,
    ca_expires_at: data.caExpiresAt,
    unit_of_measure: data.unitOfMeasure,
    lifespan_days: data.lifespanDays,
    reference_cost: data.referenceCost,
    required_training_type_id: data.requiredTrainingTypeId,
  };
}
