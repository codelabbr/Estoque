import type { Database } from "@/lib/supabase/database.types";

export type StockMovementType =
  Database["public"]["Enums"]["stock_movement_type"];

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  entrada: "Entrada",
  saida_entrega: "Entrega",
  devolucao: "Devolução",
  descarte: "Descarte",
  ajuste_positivo: "Ajuste (+)",
  ajuste_negativo: "Ajuste (−)",
  transferencia_entrada: "Transferência (entrada)",
  transferencia_saida: "Transferência (saída)",
  estorno: "Estorno",
};

export const REVERSIBLE_TYPES: StockMovementType[] = [
  "entrada",
  "ajuste_positivo",
  "ajuste_negativo",
  "descarte",
];

/** Status do saldo frente ao mínimo (para StatusBadge). */
export function stockStatus(
  balance: number,
  minStock: number,
): "ok" | "atencao" | "irregular" {
  if (balance <= 0 && minStock > 0) return "irregular";
  if (balance <= 0) return "atencao";
  if (balance < minStock) return "atencao";
  return "ok";
}
