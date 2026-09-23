import Link from "next/link";
import { Boxes, GraduationCap, HardHat, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Atalhos de registro no topo do feed, conforme o papel do usuário. */
export function QuickComposer({
  orgSlug,
  initials,
  canOperate,
  canManage,
}: {
  orgSlug: string;
  initials: string;
  canOperate: boolean;
  canManage: boolean;
}) {
  const actions = [
    canOperate && {
      icon: HardHat,
      label: "Entrega de EPI",
      href: `/${orgSlug}/entregas/nova`,
    },
    canOperate && {
      icon: Boxes,
      label: "Entrada no estoque",
      href: `/${orgSlug}/estoque/entrada`,
    },
    canManage && {
      icon: GraduationCap,
      label: "Treinamento",
      href: `/${orgSlug}/treinamentos/registrar`,
    },
    canManage && {
      icon: UserPlus,
      label: "Funcionário",
      href: `/${orgSlug}/funcionarios/novo`,
    },
  ].filter(Boolean) as { icon: typeof HardHat; label: string; href: string }[];

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-3 border-b px-4 py-4 sm:px-5">
      <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={canOperate ? `/${orgSlug}/entregas/nova` : actions[0].href}
          className="text-muted-foreground hover:text-foreground block py-2 text-lg transition-colors sm:text-xl"
        >
          O que você precisa registrar hoje?
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3 border-t pt-3">
          <ul className="-ml-2 flex items-center">
            {actions.map(({ icon: Icon, label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  title={label}
                  className="text-primary hover:bg-primary/10 flex size-10 items-center justify-center rounded-full transition-colors"
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="sr-only">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
          {canOperate && (
            <Button asChild className="rounded-full px-5 font-bold">
              <Link href={`/${orgSlug}/entregas/nova`}>Nova entrega</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
