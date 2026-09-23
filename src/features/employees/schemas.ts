import { z } from "zod";
import { cpfSchema } from "@/lib/validators";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

const optionalUuid = z
  .union([z.literal(""), z.uuid("Seleção inválida")])
  .optional()
  .transform((v) => (v ? v : null));

export const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida");

export const employeeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe o nome completo")
    .max(120, "Use no máximo 120 caracteres")
    .refine((v) => v.includes(" "), "Informe nome e sobrenome"),
  cpf: cpfSchema,
  registration: optionalText(30),
  jobRoleId: optionalUuid,
  sectorId: optionalUuid,
  unitId: optionalUuid,
  phone: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine(
      (v) => v === null || v.length === 10 || v.length === 11,
      "Telefone com DDD, 10 ou 11 dígitos",
    ),
  email: z
    .union([z.literal(""), z.email("E-mail inválido")])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
  hiredAt: optionalDate,
});

export const terminateSchema = z.object({
  terminatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de desligamento"),
});

export type EmployeeFormInput = z.input<typeof employeeSchema>;
export type EmployeeData = z.output<typeof employeeSchema>;

export function toDbEmployee(data: EmployeeData) {
  return {
    full_name: data.fullName,
    cpf: data.cpf,
    registration: data.registration,
    job_role_id: data.jobRoleId,
    sector_id: data.sectorId,
    unit_id: data.unitId,
    phone: data.phone,
    email: data.email,
    hired_at: data.hiredAt,
  };
}
