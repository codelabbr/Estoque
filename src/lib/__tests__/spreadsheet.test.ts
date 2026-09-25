import { describe, expect, it } from "vitest";
import { cellToText, sheetToTable } from "@/lib/spreadsheet";
import {
  findUnknownJobRoles,
  parseEmployeeTable,
} from "@/features/employees/csv";

describe("células do Excel", () => {
  it("converte data, número inteiro grande, decimal e booleano", () => {
    expect(cellToText(new Date(Date.UTC(2024, 2, 5)))).toBe("05/03/2024");
    expect(cellToText(52998224725)).toBe("52998224725");
    expect(cellToText(1.5)).toBe("1.5");
    expect(cellToText(true)).toBe("sim");
    expect(cellToText(null)).toBe("");
    expect(cellToText("  Ana  ")).toBe("Ana");
  });

  it("descarta linhas vazias", () => {
    expect(sheetToTable([["nome"], [null, ""], ["Ana"]])).toEqual([
      ["nome"],
      ["Ana"],
    ]);
  });

  it("planilha XLSX (datas e CPF numéricos) passa pela mesma validação do CSV", () => {
    const table = sheetToTable([
      ["nome", "cpf", "admissao", "cargo"],
      ["Ana Souza", 52998224725, new Date(Date.UTC(2024, 2, 5)), "Soldador"],
      // CPF digitado como número perde o zero à esquerda; o parser completa.
      ["Carla Dias", 4542856046, null, "Pintor"],
    ]);
    const { rows } = parseEmployeeTable(table);
    expect(rows[0]).toMatchObject({
      cpf: "52998224725",
      hiredAt: "2024-03-05",
      errors: [],
    });
    expect(rows[1]).toMatchObject({ cpf: "04542856046", errors: [] });
  });
});

describe("importação de funcionários", () => {
  it("aponta matrícula repetida na planilha", () => {
    const { rows } = parseEmployeeTable([
      ["nome", "cpf", "matricula"],
      ["Ana Souza", "52998224725", "0001"],
      ["Bruno Lima", "11144477735", "0001"],
    ]);
    expect(rows[1].errors).toContain("Matrícula repetida na linha 2");
  });

  it("lista os cargos que ainda não existem, sem repetir nem diferenciar maiúsculas", () => {
    expect(
      findUnknownJobRoles(
        [
          { jobRole: "Soldador" },
          { jobRole: "pintor" },
          { jobRole: "Pintor" },
          { jobRole: null },
          { jobRole: "Eletricista" },
        ],
        ["soldador"],
      ),
    ).toEqual(["Eletricista", "pintor"]);
  });
});
