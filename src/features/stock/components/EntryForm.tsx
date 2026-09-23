"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/shared/native-select";
import { FormError } from "@/components/shared/form-alert";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { formatCurrency } from "@/lib/format";
import { entrySchema } from "@/features/stock/schemas";
import { registerEntry } from "@/features/stock/actions";

type FormIn = z.input<typeof entrySchema>;
type FormOut = z.output<typeof entrySchema>;
type EpiOption = {
  id: string;
  name: string;
  caNumber: string | null;
  variants: { id: string; sizeLabel: string }[];
};

function parseMoney(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(
    s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s,
  );
  return Number.isFinite(n) ? n : 0;
}

export function EntryForm({
  orgSlug,
  locationId,
  locationName,
  epis,
  today,
  backHref,
}: {
  orgSlug: string;
  locationId: string;
  locationName: string;
  epis: EpiOption[];
  today: string;
  backHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [epiByRow, setEpiByRow] = useState<Record<string, string>>({});
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      locationId,
      occurredOn: today,
      items: [
        { variantId: "", quantity: "" as unknown as number, unitCost: "" },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce(
    (sum, i) => sum + Number(i?.quantity || 0) * parseMoney(i?.unitCost),
    0,
  );
  const totalQty = (items ?? []).reduce(
    (sum, i) => sum + Number(i?.quantity || 0),
    0,
  );

  const onSubmit = () => {
    setFormError(null);
    const values = getValues();
    startTransition(async () => {
      const result = await registerEntry(orgSlug, values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success("Entrada registrada");
      router.push(backHref);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" {...register("locationId")} />
      <Panel className="p-4 sm:p-6">
        <FieldGroup className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!errors.supplier}>
            <FieldLabel htmlFor="supplier">
              Fornecedor{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </FieldLabel>
            <Input id="supplier" {...register("supplier")} />
            <FieldError errors={[errors.supplier]} />
          </Field>
          <Field data-invalid={!!errors.documentRef}>
            <FieldLabel htmlFor="documentRef">
              Nota fiscal / documento{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </FieldLabel>
            <Input id="documentRef" {...register("documentRef")} />
            <FieldError errors={[errors.documentRef]} />
          </Field>
          <Field data-invalid={!!errors.occurredOn}>
            <FieldLabel htmlFor="occurredOn">Data da entrada</FieldLabel>
            <Input
              id="occurredOn"
              type="date"
              max={today}
              {...register("occurredOn")}
            />
            <FieldError errors={[errors.occurredOn]} />
          </Field>
        </FieldGroup>
        <p className="text-muted-foreground mt-4 text-sm">
          Local: <strong className="text-foreground">{locationName}</strong>
        </p>
      </Panel>

      <Panel>
        <PanelHeader title="Itens" description="Um item por EPI e tamanho." />
        <ol>
          {fields.map((field, index) => {
            const rowErrors = errors.items?.[index];
            const epiId = epiByRow[field.id] ?? "";
            const epi = epis.find((e) => e.id === epiId);
            return (
              <li
                key={field.id}
                className="grid gap-3 border-b px-4 py-4 sm:grid-cols-12 sm:px-5"
              >
                <Field
                  className="sm:col-span-4"
                  data-invalid={!!rowErrors?.variantId}
                >
                  <FieldLabel htmlFor={`epi-${index}`}>EPI</FieldLabel>
                  <NativeSelect
                    id={`epi-${index}`}
                    value={epiId}
                    onChange={(e) => {
                      const next = epis.find((x) => x.id === e.target.value);
                      setEpiByRow((m) => ({
                        ...m,
                        [field.id]: e.target.value,
                      }));
                      setValue(
                        `items.${index}.variantId`,
                        next?.variants.length === 1 ? next.variants[0].id : "",
                      );
                    }}
                  >
                    <option value="" disabled>
                      Selecione…
                    </option>
                    {epis.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.caNumber ? ` (CA ${e.caNumber})` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field
                  className="sm:col-span-2"
                  data-invalid={!!rowErrors?.variantId}
                >
                  <FieldLabel htmlFor={`size-${index}`}>Tamanho</FieldLabel>
                  <NativeSelect
                    id={`size-${index}`}
                    disabled={!epi}
                    {...register(`items.${index}.variantId`)}
                  >
                    <option value="">—</option>
                    {epi?.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sizeLabel}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[rowErrors?.variantId]} />
                </Field>
                <Field
                  className="sm:col-span-2"
                  data-invalid={!!rowErrors?.quantity}
                >
                  <FieldLabel htmlFor={`qty-${index}`}>Quantidade</FieldLabel>
                  <Input
                    id={`qty-${index}`}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    {...register(`items.${index}.quantity`)}
                  />
                  <FieldError errors={[rowErrors?.quantity]} />
                </Field>
                <Field
                  className="sm:col-span-3"
                  data-invalid={!!rowErrors?.unitCost}
                >
                  <FieldLabel htmlFor={`cost-${index}`}>
                    Custo unitário (R$)
                  </FieldLabel>
                  <Input
                    id={`cost-${index}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    {...register(`items.${index}.unitCost`)}
                  />
                  <FieldError errors={[rowErrors?.unitCost]} />
                </Field>
                <div className="flex items-end sm:col-span-1 sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="Remover item"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <details className="sm:col-span-12">
                  <summary className="text-muted-foreground cursor-pointer text-sm">
                    Lote e validade (opcional)
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Lote"
                      aria-label="Lote"
                      {...register(`items.${index}.batch`)}
                    />
                    <Input
                      type="date"
                      aria-label="Validade do lote"
                      {...register(`items.${index}.batchExpiresAt`)}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() =>
              append({
                variantId: "",
                quantity: "" as unknown as number,
                unitCost: "",
              })
            }
          >
            <Plus /> Adicionar item
          </Button>
          <p className="text-sm">
            <span className="text-muted-foreground">
              {totalQty} unidades ·{" "}
            </span>
            <strong className="text-base">{formatCurrency(total)}</strong>
          </p>
        </div>
      </Panel>

      <FormError
        message={
          formError ??
          (errors.items?.root?.message || errors.items?.message || null)
        }
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="rounded-full px-6 font-bold"
        >
          {isPending && <Loader2 className="animate-spin" />}
          Registrar entrada
        </Button>
      </div>
    </form>
  );
}
