"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";
import { getSiteUrl, safeNextPath } from "@/lib/url";
import type { ActionResult } from "@/lib/actions";
import {
  loginSchema,
  signUpSchema,
  magicLinkSchema,
  forgotPasswordSchema,
  updatePasswordSchema,
} from "./schemas";

export async function signInWithPassword(
  input: unknown,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "invalid_credentials"
          ? "E-mail ou senha incorretos."
          : mapDbError(error),
    };
  }

  return { ok: true, data: undefined };
}

export async function signUpWithPassword(
  input: unknown,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?type=signup&next=/onboarding`,
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };

  return { ok: true, data: undefined };
}

export async function signInWithMagicLink(
  input: unknown,
  next?: string,
): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?type=magiclink&next=${encodeURIComponent(safeNextPath(next))}`,
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };

  return { ok: true, data: undefined };
}

export async function requestPasswordReset(
  input: unknown,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${getSiteUrl()}/auth/confirm?type=recovery&next=/atualizar-senha`,
    },
  );
  // Não revelar se o e-mail existe ou não (evita enumeração de contas).
  if (error && error.code !== "user_not_found") {
    return { ok: false, error: mapDbError(error) };
  }

  return { ok: true, data: undefined };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: mapDbError(error) };

  return { ok: true, data: undefined };
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
