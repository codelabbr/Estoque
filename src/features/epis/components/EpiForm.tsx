"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/shared/native-select";
import { FormError } from "@/components/shared/form-alert";
import { Panel } from "@/components/shared/panel";
import { createEpiSchema } from "@/features/epis/schemas";
import { EPI_CATEGORIES, EPI_CATEGORY_LABELS } from "@/features/epis/constants";
import { createEpi, updateEpi } from "@/features/epis/actions";

type FormIn = z.input<typeof createEpiSchema>;
type FormOut = z.output<typeof createEpiSchema>;

export function EpiForm({
  orgSlug,
  epiId,
  defaultValues,
}: {
  orgSlug: string;
  epiId?: string;
  defaultValues?: Partial<FormIn>;
}) {
  const router = useRouter();
  const isEdit = !!epiId;
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(createEpiSchema),
    defaultValues: { unitOfMeasure: "un", sizes: "", ...defaultValues },
  });

  const onSubmit = () => {
    setFormError(null);
    const values = getValues();
    startTransition(async () => {
      const result = isEdit
        ? await updateEpi(orgSlug, epiId, values)
        : await createEpi(orgSlug, values);
      if (!result.ok) {
        setFormError(result.error);
        for (const [key, messages] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(key as keyof FormIn, { message: messages[0] });
        }
        return;
      }
      toast.success(isEdit ? "EPI atualizado" : "EPI cadastrado");
      router.push(`/${orgSlug}/epis/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <Panel className="p-4 sm:p-6">
        <FieldSet>
          <FieldLegend className="text-lg font-extrabold">
            Identificação
          </FieldLegend>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.name} className="sm:col-span-2">
              <FieldLabel htmlFor="name">Nome do EPI</FieldLabel>
              <Input
                id="name"
                placeholder="Ex.: Luva nitrílica"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.category}>
              <FieldLabel htmlFor="category">Categoria</FieldLabel>
              <NativeSelect
                id="category"
                aria-invalid={!!errors.category}
                {...register("category")}
                defaultValue={defaultValues?.category ?? ""}
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {EPI_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EPI_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError errors={[errors.category]} />
            </Field>
            <Field data-invalid={!!errors.unitOfMeasure}>
              <FieldLabel htmlFor="unitOfMeasure">Unidade de medida</FieldLabel>
              <Input
                id="unitOfMeasure"
                placeholder="un, par, cx"
                {...register("unitOfMeasure")}
              />
              <FieldError errors={[errors.unitOfMeasure]} />
            </Field>
            <Field data-invalid={!!errors.manufacturer}>
              <FieldLabel htmlFor="manufacturer">
                Fabricante{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </FieldLabel>
              <Input id="manufacturer" {...register("manufacturer")} />
              <FieldError errors={[errors.manufacturer]} />
            </Field>
            <Field data-invalid={!!errors.model}>
              <FieldLabel htmlFor="model">
                Modelo/referência{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </FieldLabel>
              <Input id="model" {...register("model")} />
              <FieldError errors={[errors.model]} />
            </Field>
          </FieldGroup>
        </FieldSet>
      </Panel>

      <Panel className="p-4 sm:p-6">
        <FieldSet>
          <FieldLegend className="text-lg font-extrabold">
            Certificado de Aprovação e vida útil
          </FieldLegend>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.caNumber}>
              <FieldLabel htmlFor="caNumber">Número do CA</FieldLabel>
              <Input
                id="caNumber"
                inputMode="numeric"
                placeholder="Ex.: 12345"
                aria-invalid={!!errors.caNumber}
                {...register("caNumber")}
              />
              <FieldDescription>
                Aparece na ficha de EPI de cada entrega.
              </FieldDescription>
              <FieldError errors={[errors.caNumber]} />
            </Field>
            <Field data-invalid={!!errors.caExpiresAt}>
              <FieldLabel htmlFor="caExpiresAt">Validade do CA</FieldLabel>
              <Input
                id="caExpiresAt"
                type="date"
                aria-invalid={!!errors.caExpiresAt}
                {...register("caExpiresAt")}
              />
              <FieldError errors={[errors.caExpiresAt]} />
            </Field>
            <Field data-invalid={!!errors.lifespanDays}>
              <FieldLabel htmlFor="lifespanDays">Vida útil (dias)</FieldLabel>
              <Input
                id="lifespanDays"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Ex.: 90"
                aria-invalid={!!errors.lifespanDays}
                {...register("lifespanDays")}
              />
              <FieldDescription>
                Usada para calcular a próxima troca após cada entrega.
              </FieldDescription>
              <FieldError errors={[errors.lifespanDays]} />
            </Field>
            <Field data-invalid={!!errors.referenceCost}>
              <FieldLabel htmlFor="referenceCost">
                Custo de referência (R$){" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </FieldLabel>
              <Input
                id="referenceCost"
                inputMode="decimal"
                placeholder="0,00"
                aria-invalid={!!errors.referenceCost}
                {...register("referenceCost")}
              />
              <FieldError errors={[errors.referenceCost]} />
            </Field>
          </FieldGroup>
        </FieldSet>
      </Panel>

      {!isEdit && (
        <Panel className="p-4 sm:p-6">
          <FieldSet>
            <FieldLegend className="text-lg font-extrabold">
              Tamanhos
            </FieldLegend>
            <Field data-invalid={!!errors.sizes}>
              <FieldLabel htmlFor="sizes">Tamanhos disponíveis</FieldLabel>
              <Input
                id="sizes"
                placeholder="Ex.: P, M, G, GG — ou 38, 39, 40"
                {...register("sizes")}
              />
              <FieldDescription>
                Separe por vírgula. Deixe em branco para tamanho único. Dá para
                ajustar depois.
              </FieldDescription>
              <FieldError errors={[errors.sizes]} />
            </Field>
          </FieldSet>
        </Panel>
      )}

      <FormError message={formError} />
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
          {isEdit ? "Salvar alterações" : "Cadastrar EPI"}
        </Button>
      </div>
    </form>
  );
}
