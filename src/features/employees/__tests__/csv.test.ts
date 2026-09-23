import { describe, expect, it } from "vitest";
import { parseBrDate, parseCsv, parseEmployeeCsv } from "../csv";

describe("parseCsv", () => {
  it("detecta ponto e vírgula (Excel pt-BR) e respeita aspas", () => {
    expect(parseCsv('nome;obs\n"Silva; Ana";"diz ""oi"""\n')).toEqual([
      ["nome", "obs"],
      ["Silva; Ana", 'diz "oi"'],
    ]);
  });

  it("aceita vírgula, CRLF e BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseBrDate", () => {
  it("converte dd/mm/aaaa e rejeita datas impossíveis", () => {
    expect(parseBrDate("05/03/2024")).toBe("2024-03-05");
    expect(parseBrDate("2024-03-05")).toBe("2024-03-05");
    expect(parseBrDate("31/02/2024")).toBeNull();
  });
});

describe("parseEmployeeCsv", () => {
  it("valida linhas e mapeia cabeçalhos com acento", () => {
    const csv = [
      "Nome;CPF;Matrícula;Cargo;Setor;Admissão",
      "Ana Souza;529.982.247-25;001;Soldador;Solda;05/03/2024",
      "Bruno;111.111.111-11;;;;",
      "Carla Lima;52998224725;;;;",
    ].join("\n");
    const { rows, missingColumns } = parseEmployeeCsv(csv);
    expect(missingColumns).toEqual([]);
    expect(rows[0]).toMatchObject({
      line: 2,
      fullName: "Ana Souza",
      cpf: "52998224725",
      registration: "001",
      jobRole: "Soldador",
      hiredAt: "2024-03-05",
      errors: [],
    });
    expect(rows[1].errors).toEqual([
      "Nome completo obrigatório",
      "CPF inválido",
    ]);
    expect(rows[2].errors).toEqual(["CPF repetido na linha 2"]);
  });

  it("aponta colunas obrigatórias ausentes", () => {
    expect(parseEmployeeCsv("nome;setor\nAna Souza;X").missingColumns).toEqual([
      "cpf",
    ]);
  });

  it("recupera zeros à esquerda perdidos pelo Excel", () => {
    // 012.345.678-90 salvo como número vira 1234567890
    const { rows } = parseEmployeeCsv("nome;cpf\nZé da Silva;1234567890");
    expect(rows[0].cpf).toBe("01234567890");
  });
});
