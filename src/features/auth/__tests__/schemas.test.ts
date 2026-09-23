import { describe, expect, it } from "vitest";
import { loginSchema, signUpSchema } from "@/features/auth/schemas";

describe("loginSchema", () => {
  it("aceita e-mail e senha válidos", () => {
    const result = loginSchema.safeParse({
      email: "tecnico@empresa.com",
      password: "qualquercoisa",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = loginSchema.safeParse({
      email: "não-é-email",
      password: "qualquercoisa",
    });
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("rejeita quando as senhas não coincidem", () => {
    const result = signUpSchema.safeParse({
      email: "tecnico@empresa.com",
      password: "12345678",
      confirmPassword: "87654321",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword?.[0]).toBe(
        "As senhas não coincidem",
      );
    }
  });

  it("rejeita senha curta", () => {
    const result = signUpSchema.safeParse({
      email: "tecnico@empresa.com",
      password: "123",
      confirmPassword: "123",
    });
    expect(result.success).toBe(false);
  });

  it("aceita payload válido", () => {
    const result = signUpSchema.safeParse({
      email: "tecnico@empresa.com",
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });
});
