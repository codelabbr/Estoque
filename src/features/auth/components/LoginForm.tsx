"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordInput } from "@/components/shared/password-input";
import { FormError, SuccessNotice } from "@/components/shared/form-alert";
import {
  loginSchema,
  magicLinkSchema,
  type LoginInput,
  type MagicLinkInput,
} from "@/features/auth/schemas";
import {
  signInWithPassword,
  signInWithMagicLink,
} from "@/features/auth/actions";

export function LoginForm() {
  return (
    <Tabs defaultValue="senha" className="gap-6">
      <TabsList className="w-full">
        <TabsTrigger value="senha">
          <KeyRound aria-hidden="true" />
          Senha
        </TabsTrigger>
        <TabsTrigger value="magic-link">
          <Mail aria-hidden="true" />
          Link por e-mail
        </TabsTrigger>
      </TabsList>
      <TabsContent value="senha">
        <PasswordLoginForm />
      </TabsContent>
      <TabsContent value="magic-link">
        <MagicLinkForm />
      </TabsContent>
    </Tabs>
  );
}

function PasswordLoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (data: LoginInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signInWithPassword(data);
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
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Link
              href="/recuperar-senha"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <FormError message={formError} />
        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Entrando...
            </>
          ) : (
            <>
              Entrar
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}

function MagicLinkForm() {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkInput>({ resolver: zodResolver(magicLinkSchema) });

  const onSubmit = (data: MagicLinkInput) => {
    startTransition(async () => {
      const result = await signInWithMagicLink(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSentTo(data.email);
    });
  };

  if (sentTo) {
    return (
      <SuccessNotice title="Confira seu e-mail">
        Enviamos um link de acesso para <strong>{sentTo}</strong>. Ele expira em
        alguns minutos.
      </SuccessNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="magic-email">E-mail</FieldLabel>
          <Input
            id="magic-email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <p className="text-muted-foreground text-sm">
          Você recebe um link para entrar sem precisar de senha.
        </p>
        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Enviando...
            </>
          ) : (
            "Enviar link de acesso"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
