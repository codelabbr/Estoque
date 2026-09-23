"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/shared/native-select";
import { CpfInput } from "@/components/shared/cpf-input";
import { FormError } from "@/components/shared/form-alert";
import { Panel } from "@/components/shared/panel";
import { employeeSchema } from "@/features/employees/schemas";
import { createEmployee, updateEmployee } from "@/features/employees/actions";

type FormIn = z.input<typeof employeeSchema>;
type FormOut = z.output<typeof employeeSchema>;
type Option = { id: string; name: string };

function Optional() {
  return <span className="text-muted-foreground font-normal"> (opcional)</span>;
}

export function EmployeeForm({
  orgSlug,
  employeeId,
  defaultValues,
  options,
}: {
  orgSlug: string;
  employeeId?: string;
  defaultValues?: Partial<FormIn>;
  options: { jobRoles: Option[]; sectors: Option[]; units: Option[] };
}) {
  const router = useRouter();
  const isEdit = !!employeeId;
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      cpf: "",
      jobRoleId: "",
      sectorId: "",
      unitId: "",
      ...defaultValues,
    },
  });

  const onSubmit = () => {
    setFormError(null);
    const values = getValues();
    startTransition(async () => {
      const result = isEdit
        ? await updateEmployee(orgSlug, employeeId, values)
        : await createEmployee(orgSlug, values);
      if (!result.ok) {
        setFormError(result.error);
        for (const [key, messages] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(key as keyof FormIn, { message: messages[0] });
        }
        return;
      }
      toast.success(
        isEdit ? "Funcionário atualizado" : "Funcionário cadastrado",
      );
      router.push(`/${orgSlug}/funcionarios/${result.data.id}`);
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
            Dados pessoais
          </FieldLegend>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.fullName} className="sm:col-span-2">
              <FieldLabel htmlFor="fullName">Nome completo</FieldLabel>
              <Input
                id="fullName"
                autoComplete="off"
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              <FieldError errors={[errors.fullName]} />
            </Field>
            <Field data-invalid={!!errors.cpf}>
              <FieldLabel htmlFor="cpf">CPF</FieldLabel>
              <Controller
                control={control}
                name="cpf"
                render={({ field }) => (
                  <CpfInput
                    id="cpf"
                    aria-invalid={!!errors.cpf}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <FieldError errors={[errors.cpf]} />
            </Field>
            <Field data-invalid={!!errors.registration}>
              <FieldLabel htmlFor="registration">
                Matrícula
                <Optional />
              </FieldLabel>
              <Input
                id="registration"
                aria-invalid={!!errors.registration}
                {...register("registration")}
              />
              <FieldError errors={[errors.registration]} />
            </Field>
            <Field data-invalid={!!errors.phone}>
              <FieldLabel htmlFor="phone">
                Celular
                <Optional />
              </FieldLabel>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="(11) 98765-4321"
                aria-invalid={!!errors.phone}
                {...register("phone")}
              />
              <FieldDescription>
                Usado para enviar o link de assinatura por WhatsApp.
              </FieldDescription>
              <FieldError errors={[errors.phone]} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">
                E-mail
                <Optional />
              </FieldLabel>
              <Input
                id="email"
                type="email"
                inputMode="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
          </FieldGroup>
        </FieldSet>
      </Panel>

      <Panel className="p-4 sm:p-6">
        <FieldSet>
          <FieldLegend className="text-lg font-extrabold">Função</FieldLegend>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.jobRoleId}>
              <FieldLabel htmlFor="jobRoleId">Cargo</FieldLabel>
              <NativeSelect
                id="jobRoleId"
                aria-invalid={!!errors.jobRoleId}
                {...register("jobRoleId")}
              >
                <option value="">Sem cargo definido</option>
                {options.jobRoles.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
              <FieldDescription>
                Define os EPIs e treinamentos obrigatórios.
              </FieldDescription>
              <FieldError errors={[errors.jobRoleId]} />
            </Field>
            <Field data-invalid={!!errors.hiredAt}>
              <FieldLabel htmlFor="hiredAt">
                Admissão
                <Optional />
              </FieldLabel>
              <Input
                id="hiredAt"
                type="date"
                aria-invalid={!!errors.hiredAt}
                {...register("hiredAt")}
              />
              <FieldError errors={[errors.hiredAt]} />
            </Field>
            <Field data-invalid={!!errors.sectorId}>
              <FieldLabel htmlFor="sectorId">
                Setor
                <Optional />
              </FieldLabel>
              <NativeSelect id="sectorId" {...register("sectorId")}>
                <option value="">—</option>
                {options.sectors.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
              <FieldError errors={[errors.sectorId]} />
            </Field>
            {options.units.length > 0 && (
              <Field data-invalid={!!errors.unitId}>
                <FieldLabel htmlFor="unitId">
                  Unidade
                  <Optional />
                </FieldLabel>
                <NativeSelect id="unitId" {...register("unitId")}>
                  <option value="">—</option>
                  {options.units.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError errors={[errors.unitId]} />
              </Field>
            )}
          </FieldGroup>
        </FieldSet>
      </Panel>

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
          {isEdit ? "Salvar alterações" : "Cadastrar funcionário"}
        </Button>
      </div>
    </form>
  );
}
