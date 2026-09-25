import { describe, expect, it } from "vitest";
import { parseJobRoleTable } from "../import";

const table = (rows: string[][]) => [["Nome", "CBO", "Descrição"], ...rows];

describe("parseJobRoleTable", () => {
  it("valida nome, CBO e repetidos; marca os que já existem", () => {
    const { rows, missingColumns } = parseJobRoleTable(
      table([
        ["Soldador", "724315", "Caldeiraria"],
        ["Eletricista", "7156-10", ""],
        ["soldador", "", ""],
        ["X", "", ""],
        ["Pintor", "12-34", ""],
      ]),
      ["Eletricista"],
    );
    expect(missingColumns).toEqual([]);
    expect(rows[0]).toMatchObject({
      name: "Soldador",
      cbo: "7243-15",
      exists: false,
      errors: [],
    });
    expect(rows[1]).toMatchObject({ exists: true, errors: [] });
    expect(rows[2].errors).toEqual(["Cargo repetido na linha 2"]);
    expect(rows[3].errors).toEqual(["Nome do cargo obrigatório"]);
    expect(rows[4].errors).toEqual(["CBO no formato 0000-00"]);
  });

  it("exige a coluna nome", () => {
    expect(parseJobRoleTable([["cargo"]], []).missingColumns).toEqual(["nome"]);
  });
});
