import { describe, expect, it } from "vitest";
import { epiRequirementSchema, jobRoleSchema, sectorSchema } from "../schemas";

describe("jobRoleSchema", () => {
  it("aceita CBO no formato 0000-00 e normaliza vazios para null", () => {
    const r = jobRoleSchema.parse({
      name: " Soldador ",
      cbo: "7243-15",
      description: "",
    });
    expect(r).toEqual({ name: "Soldador", cbo: "7243-15", description: null });
  });

  it("rejeita CBO inválido", () => {
    expect(
      jobRoleSchema.safeParse({ name: "Soldador", cbo: "12" }).success,
    ).toBe(false);
  });
});

describe("sectorSchema", () => {
  it("unidade vazia vira null", () => {
    expect(sectorSchema.parse({ name: "Solda", unitId: "" }).unitId).toBeNull();
  });
});

describe("epiRequirementSchema", () => {
  it("converte quantidade de texto e exige inteiro positivo", () => {
    const id = "3f2b8a4e-2b9c-4c1e-9a55-2d4f5b6c7d8e";
    expect(
      epiRequirementSchema.parse({ epiId: id, quantity: "2" }).quantity,
    ).toBe(2);
    expect(
      epiRequirementSchema.safeParse({ epiId: id, quantity: "0" }).success,
    ).toBe(false);
  });

  it("periodicidade vazia usa a vida útil (null) e obrigatório é o padrão", () => {
    const id = "3f2b8a4e-2b9c-4c1e-9a55-2d4f5b6c7d8e";
    const r = epiRequirementSchema.parse({
      epiId: id,
      quantity: "1",
      replacementDays: "",
    });
    expect(r).toMatchObject({ replacementDays: null, mandatory: true });
    expect(
      epiRequirementSchema.parse({
        epiId: id,
        quantity: "1",
        replacementDays: "15",
        mandatory: "nao",
      }),
    ).toMatchObject({ replacementDays: 15, mandatory: false });
  });

  it("recusa periodicidade zero, negativa ou fracionada", () => {
    const id = "3f2b8a4e-2b9c-4c1e-9a55-2d4f5b6c7d8e";
    for (const replacementDays of ["0", "-5", "7.5"]) {
      expect(
        epiRequirementSchema.safeParse({
          epiId: id,
          quantity: "1",
          replacementDays,
        }).success,
      ).toBe(false);
    }
  });
});
