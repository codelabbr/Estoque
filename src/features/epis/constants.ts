import type { Database } from "@/lib/supabase/database.types";

export type EpiCategory = Database["public"]["Enums"]["epi_category"];

export const EPI_CATEGORY_LABELS: Record<EpiCategory, string> = {
  cabeca: "Proteção da cabeça",
  olhos_face: "Olhos e face",
  auditiva: "Proteção auditiva",
  respiratoria: "Proteção respiratória",
  tronco: "Tronco",
  membros_superiores: "Membros superiores",
  membros_inferiores: "Membros inferiores",
  corpo_inteiro: "Corpo inteiro",
  quedas: "Proteção contra quedas",
  outro: "Outro",
};

export const EPI_CATEGORIES = Object.keys(EPI_CATEGORY_LABELS) as EpiCategory[];
