import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalPositive = (message: string, int = true) =>
  z
    .union([
      z.literal(""),
      int
        ? z.coerce.number().int(message).positive(message)
        : z.coerce.number().positive(message),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data");

export const trainingTypeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  regulation: optionalText(20),
  validityMonths: optionalPositive(
    "Informe meses (número inteiro maior que zero)",
  ),
  workloadHours: optionalPositive("Carga horária inválida", false),
});

export const batchSchema = z
  .object({
    trainingTypeId: z.uuid("Selecione o treinamento"),
    completedAt: date,
    employeeIds: z
      .array(z.uuid())
      .min(1, "Selecione pelo menos um participante")
      .max(500),
    provider: optionalText(120),
    instructor: optionalText(120),
    workloadHours: optionalPositive("Carga horária inválida", false),
    expiresAt: z
      .string()
      .optional()
      .transform((v) => (v ? v : null)),
    certificatePath: optionalText(300),
    today: date,
  })
  .refine((d) => d.completedAt <= d.today, {
    message: "A data não pode ser no futuro",
    path: ["completedAt"],
  })
  .refine((d) => !d.expiresAt || d.expiresAt >= d.completedAt, {
    message: "A validade não pode ser anterior à conclusão",
    path: ["expiresAt"],
  });

export type BatchInput = z.input<typeof batchSchema>;
