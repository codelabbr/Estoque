"use client";

import { useRef, useState, useTransition } from "react";
import { Keyboard, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/shared/signature-pad";
import { FormError } from "@/components/shared/form-alert";
import type { ActionResult } from "@/lib/actions";

type Item = { epi: string; size: string; quantity: number; ca: string | null };

/**
 * Termo + itens + assinatura (desenho ou nome digitado). Usado na tela do
 * almoxarifado e na página pública do link.
 */
export function SignatureCapture({
  term,
  items,
  employeeName,
  onSubmit,
  submitLabel = "Confirmar recebimento",
}: {
  term: string;
  items: Item[];
  employeeName: string;
  onSubmit: (
    input:
      | { method: "desenho"; imagePng: string }
      | { method: "nome_digitado"; typedName: string },
  ) => Promise<ActionResult<unknown>>;
  submitLabel?: string;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [method, setMethod] = useState<"desenho" | "nome_digitado">("desenho");
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [padEmpty, setPadEmpty] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready =
    agreed && (method === "desenho" ? !padEmpty : typedName.trim().length >= 3);

  function submit() {
    setError(null);
    const input =
      method === "desenho"
        ? {
            method: "desenho" as const,
            imagePng: padRef.current?.toDataUrl() ?? "",
          }
        : { method: "nome_digitado" as const, typedName };
    startTransition(async () => {
      const result = await onSubmit(input);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="sig-items">
        <h3 id="sig-items" className="mb-2 text-sm font-bold">
          EPIs recebidos
        </h3>
        <ul className="divide-y overflow-clip rounded-2xl border">
          {items.map((i, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-[15px]"
            >
              <span className="min-w-0">
                <strong>{i.epi}</strong>{" "}
                <span className="text-muted-foreground">· {i.size}</span>
                {i.ca && (
                  <span className="text-muted-foreground block text-xs">
                    CA {i.ca}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-bold tabular-nums">
                {i.quantity}×
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sig-term">
        <h3 id="sig-term" className="mb-2 text-sm font-bold">
          Termo de responsabilidade
        </h3>
        <p className="bg-muted/60 max-h-40 overflow-y-auto rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line">
          {term}
        </p>
      </section>

      <div className="flex gap-2" role="tablist" aria-label="Forma de assinar">
        <Button
          type="button"
          role="tab"
          aria-selected={method === "desenho"}
          variant={method === "desenho" ? "secondary" : "ghost"}
          className="flex-1 rounded-full"
          onClick={() => setMethod("desenho")}
        >
          <PenLine /> Desenhar
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={method === "nome_digitado"}
          variant={method === "nome_digitado" ? "secondary" : "ghost"}
          className="flex-1 rounded-full"
          onClick={() => setMethod("nome_digitado")}
        >
          <Keyboard /> Digitar nome
        </Button>
      </div>

      {method === "desenho" ? (
        <SignaturePad ref={padRef} onChange={setPadEmpty} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="typedName">Nome completo</Label>
          <Input
            id="typedName"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={employeeName}
            autoComplete="name"
            className="h-12 text-lg"
          />
          <p className="text-muted-foreground text-xs">
            A assinatura por nome digitado fica registrada como um tipo
            diferente da desenhada.
          </p>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Checkbox
          id="agree"
          checked={agreed}
          onCheckedChange={(v) => setAgreed(v === true)}
          className="mt-0.5 size-5"
        />
        <Label htmlFor="agree" className="text-[15px] leading-snug font-normal">
          Li e concordo com o termo de responsabilidade e confirmo o recebimento
          dos EPIs acima.
        </Label>
      </div>

      <FormError message={error} />
      <Button
        size="lg"
        className="h-12 rounded-full text-base font-bold"
        disabled={!ready || isPending}
        onClick={submit}
      >
        {isPending && <Loader2 className="animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}
