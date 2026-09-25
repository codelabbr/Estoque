import { describe, expect, it } from "vitest";
import {
  byteaToDataUrl,
  dataUrlToBytea,
  deliverySchema,
  signatureSchema,
} from "../schemas";

const id = "3f2b8a4e-2b9c-4c1e-9a55-2d4f5b6c7d8e";
const id2 = "4f2b8a4e-2b9c-4c1e-9a55-2d4f5b6c7d8e";

describe("deliverySchema", () => {
  it("rejeita o mesmo tamanho duas vezes", () => {
    const r = deliverySchema.safeParse({
      employeeId: id,
      locationId: id,
      items: [
        { variantId: id2, quantity: 1, reason: "primeira_entrega" },
        { variantId: id2, quantity: 2, reason: "perda" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("aplica override falso por padrão", () => {
    const r = deliverySchema.parse({
      employeeId: id,
      locationId: id,
      items: [{ variantId: id2, quantity: "2", reason: "troca_dano" }],
    });
    expect(r.items[0]).toEqual({
      variantId: id2,
      quantity: 2,
      reason: "troca_dano",
      caOverride: false,
      caOverrideReason: null,
    });
  });

  it("override de CA vencido exige justificativa de 10 caracteres", () => {
    const base = { employeeId: id, locationId: id };
    const item = {
      variantId: id2,
      quantity: "1",
      reason: "primeira_entrega",
      caOverride: true,
    };
    expect(deliverySchema.safeParse({ ...base, items: [item] }).success).toBe(
      false,
    );
    expect(
      deliverySchema.safeParse({
        ...base,
        items: [{ ...item, caOverrideReason: "urgente" }],
      }).success,
    ).toBe(false);
    expect(
      deliverySchema.safeParse({
        ...base,
        items: [{ ...item, caOverrideReason: "Lote novo chega amanhã" }],
      }).success,
    ).toBe(true);
  });

  it("aceita o motivo devolução e substituição", () => {
    const r = deliverySchema.safeParse({
      employeeId: id,
      locationId: id,
      items: [
        { variantId: id2, quantity: "1", reason: "devolucao_substituicao" },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("signatureSchema", () => {
  it("aceita PNG em data URL ou nome digitado", () => {
    expect(
      signatureSchema.safeParse({
        method: "desenho",
        imagePng: "data:image/png;base64,iVBORw0KGgo=",
      }).success,
    ).toBe(true);
    expect(
      signatureSchema.safeParse({
        method: "desenho",
        imagePng: "data:image/jpeg;base64,xx",
      }).success,
    ).toBe(false);
    expect(
      signatureSchema.safeParse({
        method: "nome_digitado",
        typedName: "Ana Souza",
      }).success,
    ).toBe(true);
  });
});

describe("bytea", () => {
  it("converte ida e volta", () => {
    const url = "data:image/png;base64,iVBORw0KGgo=";
    const hex = dataUrlToBytea(url);
    expect(hex.startsWith("\\x89504e47")).toBe(true);
    expect(byteaToDataUrl(hex)).toBe(url);
  });
});
