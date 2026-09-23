import { z } from "zod";

const qty = (message = "Informe a quantidade") =>
  z.coerce
    .number({ error: message })
    .int("Use um número inteiro")
    .min(1, "Mínimo 1")
    .max(100000, "Quantidade muito alta");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") return null;
    const s = String(v).trim();
    const normalized = s.includes(",")
      ? s.replace(/\./g, "").replace(",", ".")
      : s;
    const n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido" });
      return z.NEVER;
    }
    return Math.round(n * 10000) / 10000;
  });

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida");

export const reasonSchema = z
  .string()
  .trim()
  .min(3, "Informe o motivo (mínimo 3 caracteres)")
  .max(300);

export const entryItemSchema = z.object({
  variantId: z.uuid("Selecione o EPI e o tamanho"),
  quantity: qty(),
  unitCost: optionalMoney,
  batch: optionalText(40),
  batchExpiresAt: optionalDate,
});

export const entrySchema = z.object({
  locationId: z.uuid("Selecione o local"),
  supplier: optionalText(120),
  documentRef: optionalText(60),
  occurredOn: optionalDate,
  items: z
    .array(entryItemSchema)
    .min(1, "Adicione pelo menos um item")
    .max(200),
});

export const adjustSchema = z.object({
  locationId: z.uuid(),
  variantId: z.uuid(),
  direction: z.enum(["entrada", "saida"], {
    error: "Escolha se o ajuste soma ou subtrai",
  }),
  quantity: qty(),
  reason: reasonSchema,
});

export const discardSchema = z.object({
  locationId: z.uuid(),
  variantId: z.uuid(),
  quantity: qty(),
  reason: reasonSchema,
});

export const reverseSchema = z.object({ reason: reasonSchema });

export const inventorySchema = z.object({
  locationId: z.uuid(),
  reason: reasonSchema,
  counts: z
    .array(
      z.object({
        variantId: z.uuid(),
        counted: z.coerce
          .number()
          .int("Use um número inteiro")
          .min(0, "Não pode ser negativo"),
      }),
    )
    .min(1, "Informe pelo menos uma contagem"),
});

export type EntryInput = z.input<typeof entrySchema>;
