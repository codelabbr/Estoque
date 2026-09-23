"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { SuccessNotice } from "@/components/shared/form-alert";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas";
import { requestPasswordReset } from "@/features/auth/actions";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = (data: ForgotPasswordInput) => {
    startTransition(async () => {
      await requestPasswordReset(data);
      setSent(true);
    });
  };

  if (sent) {
    return (
      <SuccessNotice title="Verifique sua caixa de entrada">
        Se houver uma conta com este e-mail, enviamos um link de redefinição de
        senha.
      </SuccessNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
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
        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Enviando...
            </>
          ) : (
            "Enviar link de redefinição"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
