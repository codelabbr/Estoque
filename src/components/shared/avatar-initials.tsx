import { cn } from "@/lib/utils";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function AvatarInitials({
  name,
  className,
  muted = false,
}: {
  name: string;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        muted ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
