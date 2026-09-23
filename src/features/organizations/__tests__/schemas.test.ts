import { describe, expect, it } from "vitest";
import {
  slugify,
  createOrganizationSchema,
} from "@/features/organizations/schemas";

describe("slugify", () => {
  it("remove acentos e espaços, e coloca em minúsculas", () => {
    expect(slugify("Indústria ABC Ltda.")).toBe("industria-abc-ltda");
  });

  it("colapsa separadores e remove hífens nas bordas", () => {
    expect(slugify("  Café & Cia  ")).toBe("cafe-cia");
  });
});

describe("createOrganizationSchema", () => {
  it("aceita um payload válido", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Indústria ABC",
      slug: "industria-abc",
      cnpj: "12.345.678/0001-90",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cnpj).toBe("12.345.678/0001-90");
  });

  it("rejeita slug com maiúsculas ou caracteres inválidos", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Indústria ABC",
      slug: "Indústria ABC",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    const result = createOrganizationSchema.safeParse({
      name: "",
      slug: "industria-abc",
    });
    expect(result.success).toBe(false);
  });
});
