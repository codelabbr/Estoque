import { StatusBadge } from "@/components/shared/status-badge";
import { daysUntil, formatDate } from "@/lib/format";

/** Situação do CA do EPI: vencido, vencendo (dentro da antecedência de alerta) ou válido. */
export function CaBadge({
  caNumber,
  expiresAt,
  alertDays,
  compact = false,
}: {
  caNumber: string | null;
  expiresAt: string | null;
  alertDays: number;
  compact?: boolean;
}) {
  if (!caNumber) return <StatusBadge status="pendente" label="Sem CA" />;
  if (!expiresAt)
    return (
      <StatusBadge
        status="pendente"
        label={compact ? "Sem validade" : "CA sem validade"}
      />
    );
  const days = daysUntil(expiresAt);
  if (days < 0)
    return (
      <StatusBadge
        status="irregular"
        label={
          compact ? "CA vencido" : `CA vencido em ${formatDate(expiresAt)}`
        }
      />
    );
  if (days <= alertDays)
    return (
      <StatusBadge
        status="atencao"
        label={
          compact
            ? `CA vence em ${days}d`
            : `CA vence em ${formatDate(expiresAt)}`
        }
      />
    );
  return (
    <StatusBadge
      status="ok"
      label={compact ? "CA válido" : `CA válido até ${formatDate(expiresAt)}`}
    />
  );
}
