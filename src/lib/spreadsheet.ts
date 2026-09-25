/** Divide CSV respeitando aspas. Detecta `;` (Excel pt-BR) ou `,`. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** dd/mm/aaaa ou aaaa-mm-dd → aaaa-mm-dd (ou null se inválida). */
export function parseBrDate(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (br) [d, m, y] = [Number(br[1]), Number(br[2]), Number(br[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  return date.toISOString().slice(0, 10);
}

/** Célula de planilha (read-excel-file) → texto no formato que os parsers esperam. */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // O Excel guarda a data sem fuso; a biblioteca devolve meia-noite UTC.
    const d = String(value.getUTCDate()).padStart(2, "0");
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${value.getUTCFullYear()}`;
  }
  if (typeof value === "number") {
    // Evita notação científica em CPF/matrícula digitados como número.
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value).trim();
}

export function sheetToTable(rows: unknown[][]): string[][] {
  return rows
    .map((r) => r.map(cellToText))
    .filter((r) => r.some((c) => c !== ""));
}

export const MAX_SPREADSHEET_BYTES = 2 * 1024 * 1024;

export function isXlsx(file: File) {
  return (
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/** Lê CSV (UTF-8 ou Windows-1252) ou XLSX (primeira aba) como tabela de texto. */
export async function readSpreadsheetFile(file: File): Promise<string[][]> {
  if (isXlsx(file)) {
    const { readSheet } = await import("read-excel-file/browser");
    return sheetToTable((await readSheet(file)) as unknown[][]);
  }
  const buffer = await file.arrayBuffer();
  // Excel pt-BR costuma salvar CSV em Windows-1252; tenta UTF-8 primeiro.
  let content = new TextDecoder("utf-8").decode(buffer);
  if (content.includes("�"))
    content = new TextDecoder("windows-1252").decode(buffer);
  return parseCsv(content);
}
