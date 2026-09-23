import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Voltar"
            className="hover:bg-foreground/[0.06] -ml-2 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-[15px]">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      )}
    </div>
  );
}
