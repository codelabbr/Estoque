import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-up bg-card relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="from-primary/[0.06] pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b to-transparent"
      />
      {Icon && (
        <div className="relative">
          <div
            aria-hidden="true"
            className="bg-primary/15 absolute inset-0 scale-150 rounded-full blur-xl"
          />
          <span className="bg-background ring-border text-primary relative flex size-14 items-center justify-center rounded-2xl shadow-sm ring-1">
            <Icon className="size-6" aria-hidden="true" />
          </span>
        </div>
      )}
      <div className="relative max-w-md space-y-1.5">
        <p className="text-base font-semibold">{title}</p>
        {description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="relative">{action}</div>}
    </div>
  );
}
