"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { searchEmployeesForCounter } from "@/features/deliveries/actions";

type Result = { id: string; name: string; detail: string };

/** Busca de funcionário no balcão: nome, CPF ou matrícula. Enter escolhe o primeiro. */
export function EmployeePicker({
  orgSlug,
  autoFocus = true,
}: {
  orgSlug: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const current = ++seq.current;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchEmployeesForCounter(orgSlug, q);
        if (current === seq.current) {
          setResults(rows);
          setSearched(true);
        }
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [q, orgSlug]);

  const choose = (id: string) =>
    router.push(`/${orgSlug}/entregas/nova?funcionario=${id}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
        <Input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) choose(results[0].id);
          }}
          placeholder="Nome, CPF ou matrícula"
          aria-label="Buscar funcionário por nome, CPF ou matrícula"
          className="h-14 rounded-full pl-12 text-lg"
        />
        {isPending && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin" />
        )}
      </div>
      {results.length > 0 && (
        <ul
          className="overflow-clip rounded-2xl border"
          role="listbox"
          aria-label="Funcionários encontrados"
        >
          {results.map((r) => (
            <li
              key={r.id}
              role="option"
              aria-selected={false}
              className="border-b last:border-b-0"
            >
              <button
                type="button"
                onClick={() => choose(r.id)}
                className="hover:bg-foreground/[0.04] flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
              >
                <AvatarInitials name={r.name} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{r.name}</span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {r.detail}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && !isPending && (
        <p className="text-muted-foreground px-2 text-sm">
          Nenhum funcionário ativo encontrado.
        </p>
      )}
    </div>
  );
}
