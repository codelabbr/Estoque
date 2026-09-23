import { z } from "zod";
import { DELIVERY_REASONS } from "./constants";

export const deliveryItemSchema = z.object({
  variantId: z.uuid("Selecione o tamanho"),
  quantity: z.coerce
    .number()
    .int("Use um número inteiro")
    .min(1, "Mínimo 1")
    .max(999),
  reason: z.enum(DELIVERY_REASONS, { error: "Selecione o motivo" }),
  caOverride: z.boolean().default(false),
});

export const deliverySchema = z.object({
  employeeId: z.uuid(),
  locationId: z.uuid(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  items: z
    .array(deliveryItemSchema)
    .min(1, "Adicione pelo menos um EPI")
    .max(50)
    .refine(
      (items) => new Set(items.map((i) => i.variantId)).size === items.length,
      "O mesmo EPI e tamanho aparece duas vezes",
    ),
});

export const cancelDeliverySchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo").max(300),
});

export const returnItemSchema = z.object({
  destination: z.enum(["estoque", "descarte"], { error: "Escolha o destino" }),
  notes: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
});

/** PNG em data URL, limitado a ~220 KB de imagem. */
const pngDataUrl = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Assinatura inválida")
  .max(300_000, "Assinatura muito grande");

export const signatureSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("desenho"), imagePng: pngDataUrl }),
  z.object({
    method: z.literal("nome_digitado"),
    typedName: z.string().trim().min(3, "Digite o nome completo").max(120),
  }),
]);

export type DeliveryInput = z.input<typeof deliverySchema>;

/** data:image/png;base64,... → formato hex do bytea do Postgres (\x...). */
export function dataUrlToBytea(dataUrl: string): string {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return `\\x${Buffer.from(base64, "base64").toString("hex")}`;
}

/** \x... (bytea do PostgREST) → data URL PNG. */
export function byteaToDataUrl(bytea: string): string {
  const hex = bytea.startsWith("\\x") ? bytea.slice(2) : bytea;
  return `data:image/png;base64,${Buffer.from(hex, "hex").toString("base64")}`;
}
