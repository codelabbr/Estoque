/**
 * CSV para o Excel brasileiro: separador `;`, UTF-8 com BOM, decimais com
 * vírgula. Datas já devem vir formatadas (dd/MM/aaaa) pelo chamador.
 */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "number" ? String(value).replace(".", ",") : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(";")];
  for (const row of rows)
    lines.push(columns.map((c) => cell(c.value(row))).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, fileName: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
