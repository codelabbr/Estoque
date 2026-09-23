import { describe, expect, it } from "vitest";
import { createEpiSchema, variantSchema } from "../schemas";

const base = { name: "Luva nitrílica", category: "membros_superiores" };

describe("createEpiSchema", () => {
  it("separa tamanhos por vírgula, sem duplicar nem vazios", () => {
    const r = createEpiSchema.parse({ ...base, sizes: "P, M,m ,M,, G" });
    expect(r.sizes).toEqual(["P", "M", "m", "G"]);
  });

  it("normaliza CA para dígitos e valida o tamanho", () => {
    expect(
      createEpiSchema.parse({ ...base, caNumber: "CA 12.345" }).caNumber,
    ).toBe("12345");
    expect(createEpiSchema.safeParse({ ...base, caNumber: "12" }).success).toBe(
      false,
    );
  });

  it("aceita custo com vírgula", () => {
    expect(
      createEpiSchema.parse({ ...base, referenceCost: "1.234,56" })
        .referenceCost,
    ).toBe(1234.56);
    expect(
      createEpiSchema.parse({ ...base, referenceCost: "12.5" }).referenceCost,
    ).toBe(12.5);
  });

  it("campos opcionais vazios viram null e unidade padrão é 'un'", () => {
    const r = createEpiSchema.parse({
      ...base,
      lifespanDays: "",
      caExpiresAt: "",
      unitOfMeasure: "",
    });
    expect(r.lifespanDays).toBeNull();
    expect(r.caExpiresAt).toBeNull();
    expect(r.unitOfMeasure).toBe("un");
  });

  it("vida útil precisa ser positiva", () => {
    expect(
      createEpiSchema.safeParse({ ...base, lifespanDays: "0" }).success,
    ).toBe(false);
    expect(
      createEpiSchema.parse({ ...base, lifespanDays: "90" }).lifespanDays,
    ).toBe(90);
  });
});

describe("variantSchema", () => {
  it("estoque mínimo não pode ser negativo", () => {
    expect(
      variantSchema.safeParse({ sizeLabel: "M", minStock: "-1" }).success,
    ).toBe(false);
    expect(
      variantSchema.parse({ sizeLabel: "M", minStock: "10" }).minStock,
    ).toBe(10);
  });
});
