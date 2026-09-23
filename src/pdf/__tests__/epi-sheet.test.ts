// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { EpiSheet, type EpiSheetData } from "../EpiSheet";

const data: EpiSheetData = {
  org: {
    name: "Aço Peças",
    legalName: "Aço Peças Oliveira Ltda.",
    cnpj: "11222333000181",
  },
  employee: {
    name: "Ana Maria Souza",
    cpf: "529.982.247-25",
    registration: "001",
    jobRole: "Soldador",
    sector: "Solda",
    hiredAt: "05/03/2024",
  },
  term: "Declaro ter recebido os EPIs abaixo...",
  rows: [
    {
      date: "23/09/2026",
      epi: "Luva de raspa",
      size: "M",
      quantity: 2,
      ca: "12345",
      reason: "Primeira entrega",
      returnedAt: null,
      signature: { kind: "nome", name: "Ana Maria Souza" },
      caOverride: true,
    },
    {
      date: "23/09/2026",
      epi: "Botina",
      size: "40",
      quantity: 1,
      ca: "22222",
      reason: "Troca por dano",
      returnedAt: "30/09/2026",
      signature: { kind: "pendente" },
      caOverride: false,
    },
  ],
  emittedAt: "23/09/2026 às 16:00",
  emittedBy: "tst@empresa.com",
  code: "ABCDEF123456",
};

describe("EpiSheet", () => {
  it("gera um PDF válido com as linhas da ficha", async () => {
    const buffer = await renderToBuffer(
      createElement(EpiSheet, { data }) as Parameters<typeof renderToBuffer>[0],
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(2000);
  }, 30_000);
});
