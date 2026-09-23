"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { PasswordInput } from "@/components/shared/password-input";
import { FormError } from "@/components/shared/form-alert";
import {
  updatePasswordSchema,
  type UpdatePasswordInput,
} from "@/features/auth/schemas";
import { updatePassword } from "@/features/auth/actions";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const onSubmit = (data: UpdatePasswordInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updatePassword(data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.replace("/");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Nova senha</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">
            Confirmar nova senha
          </FieldLabel>
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
              Salvando...
            </>
          ) : (
            "Salvar nova senha"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
