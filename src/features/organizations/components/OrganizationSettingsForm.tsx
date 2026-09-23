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
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { FormError } from "@/components/shared/form-alert";
import { Panel } from "@/components/shared/panel";
import { updateOrganizationSchema } from "@/features/organizations/schemas";
import { updateOrganization } from "@/features/organizations/actions";

type FormIn = z.input<typeof updateOrganizationSchema>;
type FormOut = z.output<typeof updateOrganizationSchema>;

export function OrganizationSettingsForm({
  orgSlug,
  defaultValues,
  readOnly,
}: {
  orgSlug: string;
  defaultValues: FormIn;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues,
  });

  const onSubmit = () => {
    setFormError(null);
    const values = getValues();
    startTransition(async () => {
      const result = await updateOrganization(orgSlug, values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success("Configurações salvas");
      reset(values);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <fieldset disabled={readOnly} className="contents">
        <Panel className="p-4 sm:p-6">
          <FieldSet>
            <FieldLegend className="text-lg font-extrabold">
              Empresa
            </FieldLegend>
            <FieldDescription>
              Aparece no cabeçalho das fichas de EPI e relatórios.
            </FieldDescription>
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">Nome fantasia</FieldLabel>
                <Input
                  id="name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.cnpj}>
                <FieldLabel htmlFor="cnpj">CNPJ</FieldLabel>
                <Input
                  id="cnpj"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  aria-invalid={!!errors.cnpj}
                  {...register("cnpj")}
                />
                <FieldError errors={[errors.cnpj]} />
              </Field>
              <Field
                data-invalid={!!errors.legalName}
                className="sm:col-span-2"
              >
                <FieldLabel htmlFor="legalName">Razão social</FieldLabel>
                <Input id="legalName" {...register("legalName")} />
                <FieldError errors={[errors.legalName]} />
              </Field>
            </FieldGroup>
          </FieldSet>
        </Panel>

        <Panel className="p-4 sm:p-6">
          <FieldSet>
            <FieldLegend className="text-lg font-extrabold">
              Termo de responsabilidade
            </FieldLegend>
            <FieldDescription>
              Texto que o funcionário aceita ao assinar a entrega de EPI. Cada
              assinatura guarda uma cópia do texto vigente.
            </FieldDescription>
            <Field data-invalid={!!errors.responsibilityTerm}>
              <FieldLabel htmlFor="responsibilityTerm" className="sr-only">
                Termo de responsabilidade
              </FieldLabel>
              <Textarea
                id="responsibilityTerm"
                rows={6}
                aria-invalid={!!errors.responsibilityTerm}
                {...register("responsibilityTerm")}
              />
              <FieldError errors={[errors.responsibilityTerm]} />
            </Field>
            <p className="text-muted-foreground text-xs">
              Recomendado: revise o texto com o responsável técnico de segurança
              ou assessoria jurídica.
            </p>
          </FieldSet>
        </Panel>

        <Panel className="p-4 sm:p-6">
          <FieldSet>
            <FieldLegend className="text-lg font-extrabold">
              Antecedência dos alertas
            </FieldLegend>
            <FieldDescription>
              Quantos dias antes do vencimento o item passa para “Atenção”.
            </FieldDescription>
            <FieldGroup className="grid gap-5 sm:grid-cols-3">
              <Field data-invalid={!!errors.alertDaysCa}>
                <FieldLabel htmlFor="alertDaysCa">CA de EPI (dias)</FieldLabel>
                <Input
                  id="alertDaysCa"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  {...register("alertDaysCa")}
                />
                <FieldError errors={[errors.alertDaysCa]} />
              </Field>
              <Field data-invalid={!!errors.alertDaysEpi}>
                <FieldLabel htmlFor="alertDaysEpi">
                  Troca de EPI (dias)
                </FieldLabel>
                <Input
                  id="alertDaysEpi"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  {...register("alertDaysEpi")}
                />
                <FieldError errors={[errors.alertDaysEpi]} />
              </Field>
              <Field data-invalid={!!errors.alertDaysTraining}>
                <FieldLabel htmlFor="alertDaysTraining">
                  Treinamentos (dias)
                </FieldLabel>
                <Input
                  id="alertDaysTraining"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  {...register("alertDaysTraining")}
                />
                <FieldError errors={[errors.alertDaysTraining]} />
              </Field>
            </FieldGroup>
          </FieldSet>
        </Panel>
      </fieldset>

      <FormError message={formError} />
      {!readOnly && (
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={isPending || !isDirty}
            className="rounded-full px-6 font-bold"
          >
            {isPending && <Loader2 className="animate-spin" />}
            Salvar configurações
          </Button>
        </div>
      )}
    </form>
  );
}
