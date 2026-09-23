"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormError } from "@/components/shared/form-alert";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { applyInventory } from "@/features/stock/actions";
import type { PositionRow } from "@/features/stock/queries";

/** Contagem física: só as linhas preenchidas entram; diferenças viram ajustes. */
export function InventoryForm({
  orgSlug,
  locationId,
  position,
  defaultReason,
  backHref,
}: {
  orgSlug: string;
  locationId: string;
  position: PositionRow[];
  defaultReason: string;
  backHref: string;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const balances = useMemo(
    () =>
      Object.fromEntries(
        position.flatMap((p) => p.variants.map((v) => [v.id, v.balance])),
      ),
    [position],
  );
  const filled = Object.entries(counts).filter(([, v]) => v.trim() !== "");
  const differences = filled.filter(([id, v]) => Number(v) !== balances[id]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await applyInventory(orgSlug, {
        locationId,
        reason,
        counts: filled.map(([variantId, counted]) => ({ variantId, counted })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        result.data.adjusted
          ? `Inventário concluído: ${result.data.adjusted} ${result.data.adjusted === 1 ? "ajuste gerado" : "ajustes gerados"}`
          : "Inventário conferido: nenhuma diferença",
      );
      router.push(backHref);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Contagem"
          description="Preencha a quantidade contada. Itens em branco não são alterados."
        />
        <ul>
          {position.map((p) => (
            <li key={p.epiId} className="border-b last:border-b-0">
              <p className="px-4 pt-3 font-bold sm:px-5">{p.epiName}</p>
              <ul className="pb-2">
                {p.variants.map((v) => {
                  const value = counts[v.id] ?? "";
                  const diff =
                    value.trim() === "" ? null : Number(value) - v.balance;
                  return (
                    <li
                      key={v.id}
                      className="flex items-center gap-3 px-4 py-2 sm:px-5"
                    >
                      <span className="bg-muted flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-sm font-bold">
                        {v.sizeLabel}
                      </span>
                      <span className="text-muted-foreground flex-1 text-sm">
                        Sistema:{" "}
                        <strong className="text-foreground tabular-nums">
                          {v.balance}
                        </strong>
                        {diff !== null && diff !== 0 && !Number.isNaN(diff) && (
                          <strong
                            className={
                              diff > 0
                                ? "text-status-ok-foreground ml-2"
                                : "text-status-irregular-foreground ml-2"
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </strong>
                        )}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`Contado ${p.epiName} ${v.sizeLabel}`}
                        className="w-24 text-right"
                        value={value}
                        onChange={(e) =>
                          setCounts((c) => ({ ...c, [v.id]: e.target.value }))
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <Field>
          <FieldLabel htmlFor="reason">Motivo dos ajustes</FieldLabel>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="text-muted-foreground mt-3 text-sm">
          {filled.length}{" "}
          {filled.length === 1 ? "item contado" : "itens contados"} ·{" "}
          <strong className="text-foreground">
            {differences.length}{" "}
            {differences.length === 1 ? "diferença" : "diferenças"}
          </strong>
        </p>
      </Panel>

      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          className="rounded-full"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button
          size="lg"
          className="rounded-full px-6 font-bold"
          disabled={isPending || filled.length === 0}
          onClick={submit}
        >
          {isPending && <Loader2 className="animate-spin" />}
          Finalizar inventário
        </Button>
      </div>
    </div>
  );
}
