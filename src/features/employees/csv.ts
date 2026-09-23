import { isValidCpf } from "@/lib/validators";

/** Colunas aceitas na importação (cabeçalho sem acento, minúsculo). */
export const IMPORT_COLUMNS = {
  nome: "fullName",
  cpf: "cpf",
  matricula: "registration",
  cargo: "jobRole",
  setor: "sector",
  admissao: "hiredAt",
  telefone: "phone",
  email: "email",
} as const;

export type ImportRow = {
  line: number;
  fullName: string;
  cpf: string;
  registration: string | null;
  jobRole: string | null;
  sector: string | null;
  hiredAt: string | null;
  phone: string | null;
  email: string | null;
  errors: string[];
};

function normalizeHeader(h: string) {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

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

/** Converte o CSV em linhas validadas (erros por linha, sem lançar). */
export function parseEmployeeCsv(text: string): {
  rows: ImportRow[];
  missingColumns: string[];
} {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], missingColumns: ["nome", "cpf"] };
  const header = table[0].map(normalizeHeader);
  const index = (col: keyof typeof IMPORT_COLUMNS) => header.indexOf(col);
  const missingColumns = (["nome", "cpf"] as const).filter(
    (c) => index(c) === -1,
  );
  if (missingColumns.length) return { rows: [], missingColumns };

  const get = (cells: string[], col: keyof typeof IMPORT_COLUMNS) => {
    const i = index(col);
    const v = i >= 0 ? (cells[i] ?? "").trim() : "";
    return v === "" ? null : v;
  };

  const seenCpf = new Map<string, number>();
  const rows = table.slice(1).map((cells, i): ImportRow => {
    const line = i + 2;
    const errors: string[] = [];
    const fullName = get(cells, "nome") ?? "";
    const cpf = (get(cells, "cpf") ?? "").replace(/\D/g, "").padStart(11, "0");
    const hiredRaw = get(cells, "admissao");
    const hiredAt = hiredRaw ? parseBrDate(hiredRaw) : null;
    const phone = get(cells, "telefone")?.replace(/\D/g, "") || null;
    const email = get(cells, "email")?.toLowerCase() ?? null;

    if (fullName.length < 3 || !fullName.includes(" "))
      errors.push("Nome completo obrigatório");
    if (!isValidCpf(cpf)) errors.push("CPF inválido");
    else if (seenCpf.has(cpf))
      errors.push(`CPF repetido na linha ${seenCpf.get(cpf)}`);
    else seenCpf.set(cpf, line);
    if (hiredRaw && !hiredAt)
      errors.push("Data de admissão inválida (use dd/mm/aaaa)");
    if (phone && phone.length !== 10 && phone.length !== 11)
      errors.push("Telefone inválido");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push("E-mail inválido");

    return {
      line,
      fullName,
      cpf,
      registration: get(cells, "matricula"),
      jobRole: get(cells, "cargo"),
      sector: get(cells, "setor"),
      hiredAt,
      phone,
      email,
      errors,
    };
  });
  return { rows, missingColumns: [] };
}
