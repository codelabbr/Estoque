import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("usa ; e BOM, vírgula decimal e escapa aspas/quebras", () => {
    const csv = toCsv(
      [
        { nome: 'Luva "nitrílica"', custo: 12.5, obs: "a;b" },
        { nome: "Botina", custo: null, obs: "linha\nnova" },
      ],
      [
        { header: "Nome", value: (r) => r.nome },
        { header: "Custo", value: (r) => r.custo },
        { header: "Obs", value: (r) => r.obs },
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe(
      '﻿Nome;Custo;Obs\r\n"Luva ""nitrílica""";12,5;"a;b"\r\nBotina;;"linha\nnova"\r\n',
    );
  });
});
