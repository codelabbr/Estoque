"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { PasswordInput } from "@/components/shared/password-input";
import { FormError, SuccessNotice } from "@/components/shared/form-alert";
import { signUpSchema, type SignUpInput } from "@/features/auth/schemas";
import { signUpWithPassword } from "@/features/auth/actions";

export function SignUpForm() {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = (data: SignUpInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUpWithPassword(data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setSentTo(data.email);
    });
  };

  if (sentTo) {
    return (
      <SuccessNotice title="Confirme seu e-mail">
        Enviamos um link de confirmação para <strong>{sentTo}</strong>. Clique
        nele para ativar a conta e criar sua organização.
      </SuccessNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">E-mail de trabalho</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? (
            <FieldError errors={[errors.password]} />
          ) : (
            <FieldDescription>Mínimo de 8 caracteres.</FieldDescription>
          )}
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">Confirmar senha</FieldLabel>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
        <FormError message={formError} />
        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Criando conta...
            </>
          ) : (
            "Criar conta"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
