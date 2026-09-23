import { describe, expect, it } from "vitest";
import { entrySchema, inventorySchema } from "../schemas";
import { stockStatus } from "../constants";

const v = "3f2b8a4e-2b9c-4c1e-9a55-2d4f5b6c7d8e";

describe("entrySchema", () => {
  it("converte quantidade e custo com vírgula", () => {
    const r = entrySchema.parse({
      locationId: v,
      items: [{ variantId: v, quantity: "10", unitCost: "12,5" }],
    });
    expect(r.items[0]).toMatchObject({
      quantity: 10,
      unitCost: 12.5,
      batch: null,
    });
  });

  it("exige pelo menos um item e quantidade positiva", () => {
    expect(entrySchema.safeParse({ locationId: v, items: [] }).success).toBe(
      false,
    );
    expect(
      entrySchema.safeParse({
        locationId: v,
        items: [{ variantId: v, quantity: "0" }],
      }).success,
    ).toBe(false);
  });
});

describe("inventorySchema", () => {
  it("aceita contagem zero, rejeita negativa", () => {
    expect(
      inventorySchema.safeParse({
        locationId: v,
        reason: "Inventário",
        counts: [{ variantId: v, counted: "0" }],
      }).success,
    ).toBe(true);
    expect(
      inventorySchema.safeParse({
        locationId: v,
        reason: "Inventário",
        counts: [{ variantId: v, counted: "-1" }],
      }).success,
    ).toBe(false);
  });
});

describe("stockStatus", () => {
  it("zerado com mínimo é irregular; abaixo do mínimo é atenção", () => {
    expect(stockStatus(0, 5)).toBe("irregular");
    expect(stockStatus(3, 5)).toBe("atencao");
    expect(stockStatus(5, 5)).toBe("ok");
    expect(stockStatus(0, 0)).toBe("atencao");
  });
});
