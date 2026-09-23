import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 25;

export function pageFromParams(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Paginação por links (`?page=`), preservando os demais parâmetros. */
export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize?: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
      aria-label="Paginação"
    >
      <p className="text-muted-foreground tabular-nums">
        {from}–{to} de {total}
      </p>
      <div className="flex gap-2">
        <Button
          asChild={page > 1}
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={page <= 1}
        >
          {page > 1 ? (
            <Link href={hrefFor(page - 1)}>
              <ChevronLeft /> Anterior
            </Link>
          ) : (
            <span>
              <ChevronLeft /> Anterior
            </span>
          )}
        </Button>
        <Button
          asChild={page < pages}
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={page >= pages}
        >
          {page < pages ? (
            <Link href={hrefFor(page + 1)}>
              Próxima <ChevronRight />
            </Link>
          ) : (
            <span>
              Próxima <ChevronRight />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}
