"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/shared/form-alert";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import {
  createOrganizationSchema,
  slugify,
  type CreateOrganizationInput,
} from "@/features/organizations/schemas";
import { createOrganization } from "@/features/organizations/actions";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", slug: "", cnpj: "" },
  });

  const name = watch("name");

  const onSubmit = (data: CreateOrganizationInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createOrganization(data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.replace(`/${result.data.slug}/dashboard`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nome da empresa</FieldLabel>
          <Input
            id="name"
            autoComplete="organization"
            placeholder="Indústria ABC Ltda."
            {...register("name", {
              onChange: (e) => {
                if (!slugTouched) {
                  setValue("slug", slugify(e.target.value), {
                    shouldValidate: true,
                  });
                }
              },
            })}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.slug}>
          <FieldLabel htmlFor="slug">Identificador (usado na URL)</FieldLabel>
          <Input
            id="slug"
            {...register("slug", { onChange: () => setSlugTouched(true) })}
          />
          <FieldDescription>
            {name
              ? `almoxsst.com/${watch("slug") || slugify(name)}`
              : "Ex.: industria-abc"}
          </FieldDescription>
          <FieldError errors={[errors.slug]} />
        </Field>
        <Field data-invalid={!!errors.cnpj}>
          <FieldLabel htmlFor="cnpj">CNPJ (opcional)</FieldLabel>
          <Input
            id="cnpj"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            {...register("cnpj")}
          />
          <FieldError errors={[errors.cnpj]} />
        </Field>
        <FormError message={formError} />
        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Criando organização...
            </>
          ) : (
            "Criar organização"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
