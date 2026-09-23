import { describe, expect, it } from "vitest";
import { isValidCpf, formatCpf, cpfSchema } from "@/lib/validators";

describe("isValidCpf", () => {
  it("aceita um CPF válido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita CPF com dígitos verificadores errados", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos iguais", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("rejeita CPF com tamanho incorreto", () => {
    expect(isValidCpf("123")).toBe(false);
  });
});

describe("cpfSchema", () => {
  it("normaliza e valida um CPF formatado", () => {
    const result = cpfSchema.safeParse("529.982.247-25");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("52998224725");
  });

  it("rejeita CPF inválido com mensagem em pt-BR", () => {
    const result = cpfSchema.safeParse("111.111.111-11");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("CPF inválido");
    }
  });
});

describe("formatCpf", () => {
  it("formata dígitos como CPF", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });
});
