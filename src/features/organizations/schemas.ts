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
