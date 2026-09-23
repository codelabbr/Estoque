import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas de filtro no estilo do X (sublinhado azul), dirigidas por um parâmetro da URL. */
export function FilterTabs({
  items,
  current,
  hrefFor,
}: {
  items: { value: string; label: string; count?: number }[];
  current: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <nav className="flex overflow-x-auto border-b" aria-label="Filtros">
      {items.map((item) => {
        const active = item.value === current;
        return (
          <Link
            key={item.value}
            href={hrefFor(item.value)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "hover:bg-foreground/[0.04] relative flex min-w-fit flex-1 justify-center px-4 py-3.5 text-[15px] transition-colors",
              active ? "font-bold" : "text-muted-foreground font-medium",
            )}
          >
            <span className="relative">
              {item.label}
              {typeof item.count === "number" && (
                <span className="text-muted-foreground ml-1.5 text-xs font-normal tabular-nums">
                  {item.count}
                </span>
              )}
              {active && (
                <span className="bg-primary absolute inset-x-0 -bottom-3.5 h-1 rounded-full" />
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
