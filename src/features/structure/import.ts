/** Importação de cargos: colunas nome (obrigatória), cbo e descricao. */

export type JobRoleImportRow = {
  line: number;
  name: string;
  cbo: string | null;
  description: string | null;
  /** Já existe na organização: será pulado. */
  exists: boolean;
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

/** Tabela (CSV ou XLSX) → linhas validadas, sem lançar. */
export function parseJobRoleTable(
  table: string[][],
  existing: string[],
): { rows: JobRoleImportRow[]; missingColumns: string[] } {
  if (table.length === 0) return { rows: [], missingColumns: ["nome"] };
  const header = table[0].map(normalizeHeader);
  const idx = (col: string) => header.indexOf(col);
  if (idx("nome") === -1) return { rows: [], missingColumns: ["nome"] };

  const get = (cells: string[], col: string) => {
    const i = idx(col);
    const v = i >= 0 ? (cells[i] ?? "").trim() : "";
    return v === "" ? null : v;
  };
  const known = new Set(existing.map((n) => n.trim().toLowerCase()));
  const seen = new Map<string, number>();

  const rows = table.slice(1).map((cells, i): JobRoleImportRow => {
    const line = i + 2;
    const errors: string[] = [];
    const name = get(cells, "nome") ?? "";
    const cboRaw = get(cells, "cbo");
    const cbo = cboRaw ? cboRaw.replace(/\s/g, "") : null;
    const description = get(cells, "descricao");
    const key = name.toLowerCase();

    if (name.length < 2) errors.push("Nome do cargo obrigatório");
    else if (name.length > 80) errors.push("Nome com mais de 80 caracteres");
    else if (seen.has(key))
      errors.push(`Cargo repetido na linha ${seen.get(key)}`);
    else seen.set(key, line);
    if (cbo && !/^\d{4}-?\d{2}$/.test(cbo))
      errors.push("CBO no formato 0000-00");
    if (description && description.length > 500)
      errors.push("Descrição com mais de 500 caracteres");

    return {
      line,
      name,
      cbo:
        cbo && /^\d{6}$/.test(cbo) ? `${cbo.slice(0, 4)}-${cbo.slice(4)}` : cbo,
      description,
      exists: known.has(key),
      errors,
    };
  });
  return { rows, missingColumns: [] };
}
