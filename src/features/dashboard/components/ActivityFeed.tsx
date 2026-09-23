import { BadgeCheck, Settings2 } from "lucide-react";
import { formatDateTime, formatRelativeToNow } from "@/lib/format";
import type { ActivityEntry } from "@/features/dashboard/utils";
import { staggerStyle } from "@/lib/motion";

export function ActivityFeed({
  entries,
  userName,
  initials,
}: {
  entries: ActivityEntry[];
  userName: string;
  initials: string;
}) {
  return (
    <section aria-labelledby="activity-title">
      <h2
        id="activity-title"
        className="border-b px-4 py-3 text-xl font-extrabold tracking-tight sm:px-5"
      >
        Atividade recente
      </h2>

      {entries.length === 0 ? (
        <div className="px-6 py-12 text-center sm:px-10">
          <p className="text-2xl font-extrabold tracking-tight">
            Nada por aqui ainda
          </p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-[15px]">
            Entregas, entradas de estoque e treinamentos aparecem neste feed
            assim que forem registrados.
          </p>
        </div>
      ) : (
        <ol>
          {entries.map((entry, i) => (
            <li
              key={entry.id}
              className="animate-fade-up stagger hover:bg-foreground/[0.03] flex gap-3 border-b px-4 py-3 transition-colors last:border-b-0 sm:px-5"
              style={staggerStyle(i)}
            >
              <ActorAvatar actor={entry.actor} initials={initials} />
              <div className="min-w-0 flex-1 text-[15px] leading-snug">
                <p className="flex flex-wrap items-center gap-x-1">
                  <span className="font-bold">
                    {entry.actor === "me"
                      ? userName
                      : entry.actor === "other"
                        ? "Membro da equipe"
                        : "Almox SST"}
                  </span>
                  {entry.actor === "system" && (
                    <BadgeCheck
                      className="text-primary size-4"
                      aria-label="Sistema"
                    />
                  )}
                  <span className="text-muted-foreground">·</span>
                  <time
                    dateTime={entry.createdAt}
                    title={formatDateTime(entry.createdAt)}
                    className="text-muted-foreground hover:underline"
                  >
                    {formatRelativeToNow(entry.createdAt)}
                  </time>
                </p>
                <p className="mt-0.5">
                  {entry.actor === "me" ? "Você " : ""}
                  {entry.text}.
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ActorAvatar({
  actor,
  initials,
}: {
  actor: ActivityEntry["actor"];
  initials: string;
}) {
  if (actor === "system") {
    return (
      <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
        <Settings2 className="size-5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      className={
        actor === "me"
          ? "bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          : "bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      }
    >
      {actor === "me" ? initials : "EQ"}
    </span>
  );
}
