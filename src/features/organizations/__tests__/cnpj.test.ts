import { describe, expect, it } from "vitest";
import { isValidCnpj, updateOrganizationSchema } from "../schemas";

describe("isValidCnpj", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

describe("updateOrganizationSchema", () => {
  const base = {
    name: "Aço Peças",
    responsibilityTerm: "x".repeat(60),
    alertDaysCa: "30",
    alertDaysEpi: "15",
    alertDaysTraining: "30",
  };
  it("normaliza CNPJ e converte dias", () => {
    const r = updateOrganizationSchema.parse({
      ...base,
      cnpj: "11.222.333/0001-81",
    });
    expect(r.cnpj).toBe("11222333000181");
    expect(r.alertDaysEpi).toBe(15);
  });
  it("rejeita antecedência fora do intervalo", () => {
    expect(
      updateOrganizationSchema.safeParse({ ...base, alertDaysCa: "0" }).success,
    ).toBe(false);
  });
});
