"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldSeparator,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          Acesse o Almox SST com senha ou link de acesso por e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="senha">
          <TabsList className="w-full">
            <TabsTrigger value="senha" className="flex-1">
              Senha
            </TabsTrigger>
            <TabsTrigger value="magic-link" className="flex-1">
              Link de acesso
            </TabsTrigger>
          </TabsList>
          <TabsContent value="senha">
            <PasswordLoginForm />
          </TabsContent>
          <TabsContent value="magic-link">
            <MagicLinkForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Link
              href="/recuperar-senha"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Entrando..." : "Entrar"}
        </Button>
        <FieldSeparator />
        <p className="text-muted-foreground text-center text-sm">
          Não tem conta?{" "}
          <Link
            href="/cadastro"
            className="text-primary underline-offset-4 hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}

function MagicLinkForm() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
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
      setSent(true);
    });
  };

  if (sent) {
    return (
      <p className="text-muted-foreground mt-4 text-sm">
        Enviamos um link de acesso para o seu e-mail. Confira sua caixa de
        entrada.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="magic-email">E-mail</FieldLabel>
          <Input
            id="magic-email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Enviando..." : "Enviar link de acesso"}
        </Button>
      </FieldGroup>
    </form>
  );
}
