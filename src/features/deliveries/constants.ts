import type { Database } from "@/lib/supabase/database.types";
import type { Status } from "@/components/shared/status-badge";

export type DeliveryReason = Database["public"]["Enums"]["delivery_reason"];
export type SignatureStatus = Database["public"]["Enums"]["signature_status"];

export const REASON_LABELS: Record<DeliveryReason, string> = {
  primeira_entrega: "Primeira entrega",
  troca_vencimento: "Troca por vencimento",
  troca_dano: "Troca por dano",
  perda: "Perda",
  novo_cargo: "Mudança de cargo",
  outro: "Outro",
};
export const DELIVERY_REASONS = Object.keys(REASON_LABELS) as DeliveryReason[];

export const SIGNATURE_STATUS: Record<
  SignatureStatus,
  { label: string; status: Status }
> = {
  pendente: { label: "Aguardando assinatura", status: "pendente" },
  assinada: { label: "Assinada", status: "ok" },
  expirada: { label: "Link expirado", status: "atencao" },
  cancelada: { label: "Cancelada", status: "irregular" },
};

export const REPLACEMENT_STATUS: Record<
  string,
  { label: string; status: Status }
> = {
  ok: { label: "Em dia", status: "ok" },
  proxima: { label: "Troca próxima", status: "atencao" },
  vencida: { label: "Troca vencida", status: "irregular" },
};
