"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/shared/native-select";
import { FormError } from "@/components/shared/form-alert";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { formatDate } from "@/lib/format";
import { deliverEpis } from "@/features/deliveries/actions";
import {
  DELIVERY_REASONS,
  REASON_LABELS,
  type DeliveryReason,
} from "@/features/deliveries/constants";

export type CartEpi = {
  id: string;
  name: string;
  caNumber: string | null;
  caExpiresAt: string | null;
  variants: { id: string; sizeLabel: string }[];
};

export type Suggestion = {
  epiId: string;
  variantId: string | null;
  reason: DeliveryReason;
  quantity: number;
  why: string;
};

type Line = {
  key: string;
  epiId: string;
  variantId: string;
  quantity: string;
  reason: DeliveryReason;
  caOverride: boolean;
};

let seq = 0;
const newKey = () => `l${++seq}`;

export function DeliveryCart({
  orgSlug,
  employeeId,
  locationId,
  epis,
  balances,
  suggestions,
  holdingsByEpi,
  today,
}: {
  orgSlug: string;
  employeeId: string;
  locationId: string;
  epis: CartEpi[];
  balances: Record<string, number>;
  suggestions: Suggestion[];
  holdingsByEpi: Record<string, { nextReplacementAt: string | null }>;
  today: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const epiById = useMemo(() => new Map(epis.map((e) => [e.id, e])), [epis]);

  const pendingSuggestions = suggestions.filter(
    (s) => !lines.some((l) => l.epiId === s.epiId),
  );

  function addLine(partial?: Partial<Line>) {
    const epi = partial?.epiId ? epiById.get(partial.epiId) : undefined;
    setLines((ls) => [
      ...ls,
      {
        key: newKey(),
        epiId: partial?.epiId ?? "",
        variantId:
          partial?.variantId ??
          (epi?.variants.length === 1 ? epi.variants[0].id : ""),
        quantity: partial?.quantity ?? "1",
        reason: partial?.reason ?? "primeira_entrega",
        caOverride: false,
      },
    ]);
  }
  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const problems = lines.map((l) => {
    const epi = epiById.get(l.epiId);
    const qty = Number(l.quantity);
    const balance = l.variantId ? (balances[l.variantId] ?? 0) : null;
    const caExpired = !!epi?.caExpiresAt && epi.caExpiresAt < today;
    const due = holdingsByEpi[l.epiId]?.nextReplacementAt;
    return {
      incomplete: !l.epiId || !l.variantId || !Number.isInteger(qty) || qty < 1,
      noStock: balance !== null && qty > balance,
      balance,
      caExpired,
      earlyReplacement:
        l.reason === "troca_vencimento" && !!due && due > today ? due : null,
    };
  });
  const blocked =
    lines.length === 0 ||
    problems.some(
      (p, i) =>
        p.incomplete || p.noStock || (p.caExpired && !lines[i].caOverride),
    );

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await deliverEpis(orgSlug, {
        employeeId,
        locationId,
        notes,
        items: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          reason: l.reason,
          caOverride: l.caOverride,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Entrega registrada");
      router.push(`/${orgSlug}/entregas/${result.data.id}?nova=1`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {pendingSuggestions.length > 0 && (
        <Panel className="animate-fade-up">
          <PanelHeader
            title="Sugeridos"
            description="Pelo cargo e pelas trocas vencidas. Um toque adiciona."
          />
          <ul className="flex flex-wrap gap-2 p-4 sm:p-5">
            {pendingSuggestions.map((s) => {
              const epi = epiById.get(s.epiId);
              if (!epi) return null;
              const size = epi.variants.find(
                (v) => v.id === s.variantId,
              )?.sizeLabel;
              return (
                <li key={s.epiId}>
                  <button
                    type="button"
                    onClick={() =>
                      addLine({
                        epiId: s.epiId,
                        variantId: s.variantId ?? undefined,
                        reason: s.reason,
                        quantity: String(s.quantity),
                      })
                    }
                    className="border-primary/30 bg-primary/5 hover:bg-primary/10 flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-left transition-colors"
                  >
                    <Sparkles
                      className="text-primary size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-sm">
                      <strong>{epi.name}</strong>
                      {size && ` ${size}`}
                      <span className="text-muted-foreground"> · {s.why}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Itens da entrega"
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => addLine()}
            >
              <Plus /> EPI
            </Button>
          }
        />
        {lines.length === 0 ? (
          <div className="px-4 py-10 text-center sm:px-5">
            <p className="font-bold">Nenhum item ainda</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Toque em uma sugestão ou adicione um EPI.
            </p>
          </div>
        ) : (
          <ol>
            {lines.map((l, i) => {
              const epi = epiById.get(l.epiId);
              const p = problems[i];
              return (
                <li
                  key={l.key}
                  className="grid gap-3 border-b px-4 py-4 last:border-b-0 sm:grid-cols-12 sm:px-5"
                >
                  <div className="sm:col-span-5">
                    <Label
                      htmlFor={`epi-${l.key}`}
                      className="mb-1.5 block text-sm"
                    >
                      EPI
                    </Label>
                    <NativeSelect
                      id={`epi-${l.key}`}
                      value={l.epiId}
                      onChange={(e) => {
                        const next = epiById.get(e.target.value);
                        update(l.key, {
                          epiId: e.target.value,
                          variantId:
                            next?.variants.length === 1
                              ? next.variants[0].id
                              : "",
                          caOverride: false,
                        });
                      }}
                    >
                      <option value="" disabled>
                        Selecione…
                      </option>
                      {epis.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <Label
                      htmlFor={`size-${l.key}`}
                      className="mb-1.5 block text-sm"
                    >
                      Tamanho
                    </Label>
                    <NativeSelect
                      id={`size-${l.key}`}
                      value={l.variantId}
                      disabled={!epi}
                      onChange={(e) =>
                        update(l.key, { variantId: e.target.value })
                      }
                    >
                      <option value="">—</option>
                      {epi?.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.sizeLabel} ({balances[v.id] ?? 0})
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="sm:col-span-1">
                    <Label
                      htmlFor={`qty-${l.key}`}
                      className="mb-1.5 block text-sm"
                    >
                      Qtd.
                    </Label>
                    <Input
                      id={`qty-${l.key}`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={l.quantity}
                      onChange={(e) =>
                        update(l.key, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label
                      htmlFor={`reason-${l.key}`}
                      className="mb-1.5 block text-sm"
                    >
                      Motivo
                    </Label>
                    <NativeSelect
                      id={`reason-${l.key}`}
                      value={l.reason}
                      onChange={(e) =>
                        update(l.key, {
                          reason: e.target.value as DeliveryReason,
                        })
                      }
                    >
                      {DELIVERY_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {REASON_LABELS[r]}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label="Remover item"
                      onClick={() =>
                        setLines((ls) => ls.filter((x) => x.key !== l.key))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div
                    className="flex flex-col gap-2 sm:col-span-12"
                    aria-live="polite"
                  >
                    {p.balance !== null && (
                      <p
                        className={`text-sm ${p.noStock ? "text-status-irregular-foreground font-bold" : "text-muted-foreground"}`}
                      >
                        {p.noStock
                          ? `Saldo insuficiente: há ${p.balance} em estoque.`
                          : `Saldo disponível: ${p.balance}`}
                      </p>
                    )}
                    {p.caExpired && epi && (
                      <div className="bg-status-irregular/60 flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 text-sm">
                        <AlertTriangle className="text-status-irregular-foreground size-4 shrink-0" />
                        <span className="flex-1">
                          CA {epi.caNumber} vencido em{" "}
                          {formatDate(epi.caExpiresAt!)}.
                        </span>
                        <span className="flex items-center gap-2">
                          <Checkbox
                            id={`override-${l.key}`}
                            checked={l.caOverride}
                            onCheckedChange={(v) =>
                              update(l.key, { caOverride: v === true })
                            }
                          />
                          <Label
                            htmlFor={`override-${l.key}`}
                            className="font-bold"
                          >
                            Entregar mesmo assim
                          </Label>
                        </span>
                      </div>
                    )}
                    {p.earlyReplacement && (
                      <div className="bg-status-atencao/60 flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                        <AlertTriangle className="text-status-atencao-foreground size-4 shrink-0" />
                        <span>
                          A troca só vence em {formatDate(p.earlyReplacement)}.
                          Se for troca antecipada, use “Troca por dano” ou
                          “Perda”.
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <Label htmlFor="notes" className="mb-1.5 block text-sm">
          Observações{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Panel>

      <FormError message={error} />
      <div className="bg-background/90 sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <p className="text-muted-foreground text-sm">
          {lines.length} {lines.length === 1 ? "item" : "itens"}
        </p>
        <Button
          size="lg"
          className="h-12 rounded-full px-8 text-base font-bold"
          disabled={blocked || isPending}
          onClick={submit}
        >
          {isPending && <Loader2 className="animate-spin" />}
          Registrar entrega
        </Button>
      </div>
    </div>
  );
}
