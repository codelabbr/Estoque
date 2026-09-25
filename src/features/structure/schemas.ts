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

const epiRequirementFields = {
  quantity: z.coerce
    .number({ error: "Informe a quantidade" })
    .int("Use um número inteiro")
    .min(1, "Mínimo 1")
    .max(99, "Máximo 99"),
  /** Vazio = usa a vida útil do EPI. */
  replacementDays: z
    .union([z.literal(""), z.coerce.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 3650),
      "Use um número inteiro de dias entre 1 e 3650",
    ),
  mandatory: z
    .enum(["sim", "nao"], { error: "Escolha se é obrigatório" })
    .default("sim")
    .transform((v) => v === "sim"),
};

export const epiRequirementSchema = z.object({
  epiId: z.uuid("Selecione o EPI"),
  ...epiRequirementFields,
});

export const epiRequirementUpdateSchema = z.object(epiRequirementFields);

export const trainingRequirementSchema = z.object({
  trainingTypeId: z.uuid("Selecione o treinamento"),
});

export type JobRoleInput = z.infer<typeof jobRoleSchema>;
