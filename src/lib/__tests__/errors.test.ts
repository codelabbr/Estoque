import { describe, expect, it, vi } from "vitest";
import { mapAuthError, mapDbError } from "@/lib/errors";

describe("mapAuthError", () => {
  it("traduz credenciais inválidas", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("traduz e-mail não confirmado", () => {
    expect(mapAuthError({ code: "email_not_confirmed" })).toMatch(
      /Confirme seu e-mail/,
    );
  });

  it("usa mensagem genérica e registra o erro quando o código é desconhecido", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapAuthError({ code: "algo_novo", message: "x" })).toBe(
      "Não foi possível concluir. Tente novamente em instantes.",
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("mapDbError", () => {
  it("traduz violação de unicidade", () => {
    expect(mapDbError({ code: "23505" })).toBe(
      "Já existe um registro com esses dados.",
    );
  });
});
