import { AlertCircle, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function SuccessNotice({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "bg-status-ok/60 border-status-ok-foreground/20 flex gap-3 rounded-xl border p-4",
        className,
      )}
    >
      <MailCheck
        className="text-status-ok-foreground mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{children}</p>
      </div>
    </div>
  );
}
