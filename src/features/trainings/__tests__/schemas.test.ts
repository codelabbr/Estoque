import { describe, expect, it } from "vitest";
import { batchSchema, trainingTypeSchema } from "../schemas";

const id = "3f2b8a4e-2b9c-4c1e-9a55-2d4f5b6c7d8e";
const base = { trainingTypeId: id, employeeIds: [id], today: "2026-09-23" };

describe("batchSchema", () => {
  it("rejeita conclusão no futuro e validade antes da conclusão", () => {
    expect(
      batchSchema.safeParse({ ...base, completedAt: "2026-09-24" }).success,
    ).toBe(false);
    expect(
      batchSchema.safeParse({
        ...base,
        completedAt: "2026-09-20",
        expiresAt: "2026-09-19",
      }).success,
    ).toBe(false);
    expect(
      batchSchema.safeParse({ ...base, completedAt: "2026-09-23" }).success,
    ).toBe(true);
  });

  it("exige participantes", () => {
    expect(
      batchSchema.safeParse({
        ...base,
        employeeIds: [],
        completedAt: "2026-09-20",
      }).success,
    ).toBe(false);
  });
});

describe("trainingTypeSchema", () => {
  it("validade vazia = sem vencimento fixo", () => {
    expect(
      trainingTypeSchema.parse({ name: "NR-35", validityMonths: "" })
        .validityMonths,
    ).toBeNull();
    expect(
      trainingTypeSchema.parse({ name: "NR-35", validityMonths: "24" })
        .validityMonths,
    ).toBe(24);
    expect(
      trainingTypeSchema.safeParse({ name: "NR-35", validityMonths: "0" })
        .success,
    ).toBe(false);
  });
});
