import Link from "next/link";
import { History } from "lucide-react";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/format";
import type { Json } from "@/lib/supabase/database.types";
import type { AuditEntry } from "@/features/audit/queries";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_FILTERS,
  diffAudit,
  formatAuditValue,
} from "@/features/audit/utils";

/** Campo que identifica o registro numa linha de insert/delete. */
function headline(data: Record<string, Json> | null) {
  if (!data) return null;
  for (const key of ["full_name", "name", "epi", "title", "email"]) {
    const v = data[key];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

export function AuditTrail({
  orgSlug,
  rows,
  filter,
  page,
  hasMore,
  actorEmails,
}: {
  orgSlug: string;
  rows: AuditEntry[];
  filter: string;
  page: number;
  hasMore: boolean;
  actorEmails: Record<string, string>;
}) {
  const href = (f: string, p = 1) =>
    `/${orgSlug}/configuracoes?aba=auditoria${f !== "todos" ? `&filtro=${f}` : ""}${p > 1 ? `&pagina=${p}` : ""}`;

  return (
    <Panel className="animate-fade-up">
      <PanelHeader
        title="Trilha de auditoria"
        description="Quem fez o quê e quando. Registro permanente: não pode ser alterado nem apagado."
      />
      <div className="border-b">
        <FilterTabs
          items={AUDIT_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          current={filter}
          hrefFor={(v) => href(v)}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          className="rounded-none border-0"
          title="Nada registrado ainda"
          description="As alterações feitas pela equipe aparecem aqui."
        />
      ) : (
        <ol>
          {rows.map((r) => {
            const entity = r.tableName
              ? (AUDIT_ENTITY_LABELS[r.tableName] ?? r.tableName)
              : "Organização";
            const action = AUDIT_ACTION_LABELS[r.action] ?? r.action;
            const who = r.actorId
              ? (actorEmails[r.actorId] ?? "Ex-membro")
              : "Sistema";
            const changes =
              r.action === "update" ? diffAudit(r.oldData, r.newData) : [];
            const name = headline(r.newData ?? r.oldData);
            return (
              <li
                key={r.id}
                className="border-b px-4 py-3 last:border-b-0 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-[15px]">
                    <strong>{action}</strong>{" "}
                    <span className="text-muted-foreground">·</span> {entity}
                    {name && (
                      <span className="text-muted-foreground"> · {name}</span>
                    )}
                  </p>
                  <time
                    dateTime={r.createdAt}
                    className="text-muted-foreground shrink-0 text-xs tabular-nums"
                  >
                    {formatDateTime(r.createdAt)}
                  </time>
                </div>
                <p className="text-muted-foreground text-sm">{who}</p>
                {changes.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5 text-sm">
                    {changes.slice(0, 8).map((c) => (
                      <li key={c.field}>
                        <code className="text-xs">{c.field}</code>:{" "}
                        <span className="text-muted-foreground line-through">
                          {formatAuditValue(c.before)}
                        </span>{" "}
                        → <span>{formatAuditValue(c.after)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {(r.oldData || r.newData) && (
                  <details className="mt-1.5">
                    <summary className="text-primary cursor-pointer text-xs">
                      Ver registro completo
                    </summary>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                      {r.oldData && (
                        <pre className="bg-muted max-h-60 overflow-auto rounded-lg p-2 text-[11px]">
                          <span className="font-bold">Antes</span>
                          {"\n"}
                          {JSON.stringify(r.oldData, null, 2)}
                        </pre>
                      )}
                      {r.newData && (
                        <pre className="bg-muted max-h-60 overflow-auto rounded-lg p-2 text-[11px]">
                          <span className="font-bold">Depois</span>
                          {"\n"}
                          {JSON.stringify(r.newData, null, 2)}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {(page > 1 || hasMore) && (
        <div className="flex justify-between border-t px-4 py-3 text-sm sm:px-5">
          {page > 1 ? (
            <Link
              href={href(filter, page - 1)}
              className="text-primary hover:underline"
            >
              ← Mais recentes
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link
              href={href(filter, page + 1)}
              className="text-primary hover:underline"
            >
              Mais antigas →
            </Link>
          )}
        </div>
      )}
    </Panel>
  );
}
