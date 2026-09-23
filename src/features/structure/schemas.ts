import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(2, "Informe o nome (mínimo 2 caracteres)")
  .max(80, "Use no máximo 80 caracteres");

const optionalUuid = z
  .union([z.literal(""), z.uuid("Seleção inválida")])
  .optional()
  .transform((v) => (v ? v : null));

const optionalText = z
  .string()
  .trim()
  .max(500, "Texto muito longo")
  .optional()
  .transform((v) => (v ? v : null));

export const unitSchema = z.object({ name });
export const sectorSchema = z.object({ name, unitId: optionalUuid });
export const jobRoleSchema = z.object({
  name,
  cbo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || /^\d{4}-?\d{2}$/.test(v),
      "CBO no formato 0000-00",
    ),
  description: optionalText,
});

export const epiRequirementSchema = z.object({
  epiId: z.uuid("Selecione o EPI"),
  quantity: z.coerce
    .number({ error: "Informe a quantidade" })
    .int("Use um número inteiro")
    .min(1, "Mínimo 1")
    .max(99, "Máximo 99"),
});

export const trainingRequirementSchema = z.object({
  trainingTypeId: z.uuid("Selecione o treinamento"),
});

export type JobRoleInput = z.infer<typeof jobRoleSchema>;
