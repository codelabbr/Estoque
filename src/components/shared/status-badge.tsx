import { CheckCircle2, Clock, AlertTriangle, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

export type Status = "ok" | "atencao" | "irregular" | "pendente";

const STATUS_CONFIG: Record<
  Status,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  ok: {
    label: "Em dia",
    icon: CheckCircle2,
    className: "bg-status-ok text-status-ok-foreground",
  },
  atencao: {
    label: "Atenção",
    icon: Clock,
    className: "bg-status-atencao text-status-atencao-foreground",
  },
  irregular: {
    label: "Irregular",
    icon: AlertTriangle,
    className: "bg-status-irregular text-status-irregular-foreground",
  },
  pendente: {
    label: "Pendente",
    icon: CircleDashed,
    className: "bg-status-pendente text-status-pendente-foreground",
  },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
}
