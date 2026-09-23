"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setMyDailyDigest } from "@/features/alerts/actions";

export function DigestToggle({
  orgSlug,
  enabled,
}: {
  orgSlug: string;
  enabled: boolean;
}) {
  const [value, setValue] = useState(enabled);
  const [isPending, startTransition] = useTransition();
  return (
    <div
      id="resumo"
      className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5"
    >
      <Label
        htmlFor="digest"
        className="flex flex-col items-start gap-0.5 font-normal"
      >
        <span className="font-bold">Resumo diário por e-mail</span>
        <span className="text-muted-foreground text-sm">
          Às 7h, só quando houver algo novo.
        </span>
      </Label>
      <Switch
        id="digest"
        checked={value}
        disabled={isPending}
        onCheckedChange={(v) =>
          startTransition(async () => {
            const r = await setMyDailyDigest(orgSlug, v);
            if (!r.ok) toast.error(r.error);
            else {
              setValue(v);
              toast.success(
                v ? "Resumo diário ativado" : "Resumo diário desativado",
              );
            }
          })
        }
      />
    </div>
  );
}
