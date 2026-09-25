import { isValidCpf } from "@/lib/validators";
import { parseBrDate, parseCsv } from "@/lib/spreadsheet";

// Reexportados para quem já importava daqui.
export { parseBrDate, parseCsv };

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

/** Converte o CSV em linhas validadas (erros por linha, sem lançar). */
export function parseEmployeeCsv(text: string) {
  return parseEmployeeTable(parseCsv(text));
}

/** Cargos citados na planilha que ainda não existem (sem diferenciar maiúsculas). */
export function findUnknownJobRoles(
  rows: Pick<ImportRow, "jobRole">[],
  existing: string[],
): string[] {
  const known = new Set(existing.map((n) => n.trim().toLowerCase()));
  const unknown = new Map<string, string>();
  for (const r of rows) {
    const name = r.jobRole?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!known.has(key) && !unknown.has(key)) unknown.set(key, name);
  }
  return [...unknown.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Tabela (de CSV ou XLSX) → linhas validadas (erros por linha, sem lançar). */
export function parseEmployeeTable(table: string[][]): {
  rows: ImportRow[];
  missingColumns: string[];
} {
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
  const seenRegistration = new Map<string, number>();
  const rows = table.slice(1).map((cells, i): ImportRow => {
    const line = i + 2;
    const errors: string[] = [];
    const registration = get(cells, "matricula");
    if (registration) {
      const key = registration.toLowerCase();
      if (seenRegistration.has(key))
        errors.push(`Matrícula repetida na linha ${seenRegistration.get(key)}`);
      else seenRegistration.set(key, line);
    }
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
      registration,
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
