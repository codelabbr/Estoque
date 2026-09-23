"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClockOff, Check, Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveAlert, snoozeAlert } from "@/features/alerts/actions";

export function AlertRowActions({
  orgSlug,
  alertKey,
}: {
  orgSlug: string;
  alertKey: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => ReturnType<typeof resolveAlert>, message: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(message);
        router.refresh();
      }
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          aria-label="Mais ações"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <MoreHorizontal />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            run(
              () => snoozeAlert(orgSlug, alertKey, 7),
              "Alerta adiado por 7 dias",
            )
          }
        >
          <AlarmClockOff /> Adiar 7 dias
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            run(
              () => resolveAlert(orgSlug, alertKey),
              "Alerta marcado como resolvido",
            )
          }
        >
          <Check /> Marcar como resolvido
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
