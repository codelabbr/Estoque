import type { Database } from "@/lib/supabase/database.types";

export type OrgRole = Database["public"]["Enums"]["org_role"];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  safety: "Segurança do trabalho",
  storekeeper: "Almoxarife",
  viewer: "Somente leitura",
};

/** Cadastros (funcionários, EPIs, cargos, treinamentos). Espelha a RLS. */
export function canManageRegistry(role: OrgRole): boolean {
  return role === "owner" || role === "admin" || role === "safety";
}

/** Operação de almoxarifado (estoque, entregas). */
export function canOperateStock(role: OrgRole): boolean {
  return canManageRegistry(role) || role === "storekeeper";
}

/** Configurações da organização, equipe e auditoria. */
export function isOrgAdmin(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}
