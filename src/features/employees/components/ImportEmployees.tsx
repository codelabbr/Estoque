"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { FormError } from "@/components/shared/form-alert";
import { maskCpfPartial } from "@/lib/validators";
import {
  MAX_SPREADSHEET_BYTES,
  parseCsv,
  readSpreadsheetFile,
} from "@/lib/spreadsheet";
import {
  findUnknownJobRoles,
  parseEmployeeTable,
} from "@/features/employees/csv";
import {
  importEmployees,
  type ImportEmployeesResult,
} from "@/features/employees/actions";

const TEMPLATE =
  "nome;cpf;matricula;cargo;setor;admissao;telefone;email\n" +
  "Ana Souza;529.982.247-25;0001;Soldador;Caldeiraria;05/03/2024;(11) 98765-4321;ana@empresa.com.br\n";

const SKIP_REASON: Record<string, string> = {
  ja_cadastrado: "CPF ou matrícula já cadastrados",
  cargo_inexistente: "cargo não existe (você optou por não criar)",
};

function downloadTemplate() {
  const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-funcionarios.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportEmployees({
  orgSlug,
  existingJobRoles,
}: {
  orgSlug: string;
  existingJobRoles: string[];
}) {
  const router = useRouter();
  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [createRoles, setCreateRoles] = useState(false);
  const [reading, setReading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportEmployeesResult | null>(null);

  const parsed = useMemo(() => {
    const source = table ?? (pasted.trim() ? parseCsv(pasted) : null);
    return source ? parseEmployeeTable(source) : null;
  }, [table, pasted]);
  const valid = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsed?.rows.filter((r) => r.errors.length > 0) ?? [];
  const unknownRoles = findUnknownJobRoles(valid, existingJobRoles);
  const unknownKeys = new Set(unknownRoles.map((n) => n.toLowerCase()));
  const blockedByRole = createRoles
    ? 0
    : valid.filter((r) => r.jobRole && unknownKeys.has(r.jobRole.toLowerCase()))
        .length;
  const toImport = valid.length - blockedByRole;

  async function onFile(file: File) {
    setError(null);
    setResult(null);
    if (file.size > MAX_SPREADSHEET_BYTES) {
      setError("Arquivo maior que 2 MB. Divida a planilha.");
      return;
    }
    setReading(true);
    try {
      setTable(await readSpreadsheetFile(file));
      setFileName(file.name);
      setPasted("");
    } catch {
      setError(
        "Não foi possível ler o arquivo. Use CSV ou XLSX (Excel) com o cabeçalho na primeira linha.",
      );
    } finally {
      setReading(false);
    }
  }

  function reset() {
    setTable(null);
    setFileName(null);
    setPasted("");
    setResult(null);
    setCreateRoles(false);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await importEmployees(
        orgSlug,
        valid.map((row) => ({
          fullName: row.fullName,
          cpf: row.cpf,
          registration: row.registration,
          jobRole: row.jobRole,
          sector: row.sector,
          hiredAt: row.hiredAt,
          phone: row.phone,
          email: row.email,
        })),
        createRoles,
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(r.data);
      toast.success(
        `${r.data.inserted} ${r.data.inserted === 1 ? "funcionário importado" : "funcionários importados"}`,
      );
      router.refresh();
    });
  }

  if (result) {
    return (
      <Panel className="animate-fade-up">
        <PanelHeader
          title="Importação concluída"
          description={`${result.inserted} importados · ${result.skipped} pulados · ${invalidRows.length} com erro na planilha`}
        />
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          {result.createdJobRoles.length > 0 && (
            <p className="flex gap-2 text-sm">
              <Info className="text-primary mt-0.5 size-4 shrink-0" />
              <span>
                Cargos criados:{" "}
                <strong>{result.createdJobRoles.join(", ")}</strong>. Monte a
                matriz de EPIs de cada um em Cargos.
              </span>
            </p>
          )}
          {result.skippedRows.length > 0 && (
            <ul className="rounded-xl border">
              {result.skippedRows.map((s) => (
                <li
                  key={`${s.cpf}-${s.reason}`}
                  className="flex gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <AlertTriangle className="text-status-atencao-foreground mt-0.5 size-4 shrink-0" />
                  <span>
                    <strong>{s.name}</strong> · {maskCpfPartial(s.cpf)} —{" "}
                    {SKIP_REASON[s.reason] ?? s.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 sm:px-5">
          <Button variant="outline" className="rounded-full" onClick={reset}>
            Importar outra planilha
          </Button>
          <Button asChild className="rounded-full font-bold">
            <Link href={`/${orgSlug}/funcionarios`}>Ver funcionários</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <PanelHeader
          title="1. Envie a planilha"
          description="CSV ou Excel (XLSX) com as colunas nome e cpf (obrigatórias) e, se quiser, matricula, cargo, setor, admissao, telefone e email."
          actions={
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={downloadTemplate}
            >
              <Download /> Planilha modelo
            </Button>
          }
        />
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <label className="hover:bg-foreground/[0.03] flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors">
            {reading ? (
              <Loader2 className="text-primary size-7 animate-spin" />
            ) : (
              <FileUp className="text-primary size-7" aria-hidden="true" />
            )}
            <span className="font-bold">
              {fileName ?? "Escolher arquivo CSV ou Excel"}
            </span>
            <span className="text-muted-foreground text-sm">
              Primeira aba da planilha, com o cabeçalho na primeira linha. Até 2
              MB.
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <details>
            <summary className="text-muted-foreground cursor-pointer text-sm">
              Ou cole o conteúdo aqui
            </summary>
            <Textarea
              value={pasted}
              onChange={(e) => {
                setTable(null);
                setFileName(null);
                setPasted(e.target.value);
              }}
              rows={6}
              className="mt-2 font-mono text-xs"
              placeholder={TEMPLATE}
            />
          </details>
          {parsed?.missingColumns.length ? (
            <FormError
              message={`Colunas obrigatórias ausentes: ${parsed.missingColumns.join(", ")}.`}
            />
          ) : null}
          <FormError message={error} />
        </div>
      </Panel>

      {parsed && parsed.rows.length > 0 && (
        <Panel className="animate-fade-up">
          <PanelHeader
            title="2. Confira"
            description={`${valid.length} linhas válidas · ${invalidRows.length} com problema`}
          />

          {unknownRoles.length > 0 && (
            <div className="bg-status-atencao/40 flex flex-col gap-2 border-b px-4 py-3 sm:px-5">
              <p className="text-sm">
                <strong>
                  {unknownRoles.length === 1
                    ? "1 cargo ainda não existe:"
                    : `${unknownRoles.length} cargos ainda não existem:`}
                </strong>{" "}
                {unknownRoles.join(", ")}
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="create-roles"
                  checked={createRoles}
                  onCheckedChange={(v) => setCreateRoles(v === true)}
                />
                <Label htmlFor="create-roles" className="text-sm leading-snug">
                  Criar{" "}
                  {unknownRoles.length === 1 ? "este cargo" : "esses cargos"} ao
                  importar. Sem marcar, os funcionários com esses cargos não são
                  importados.
                </Label>
              </div>
            </div>
          )}

          {invalidRows.length > 0 && (
            <ul className="border-b">
              {invalidRows.slice(0, 50).map((r) => (
                <li
                  key={r.line}
                  className="flex gap-3 border-b px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
                >
                  <AlertTriangle className="text-status-irregular-foreground mt-0.5 size-4 shrink-0" />
                  <span>
                    <strong>Linha {r.line}</strong>{" "}
                    {r.fullName && `· ${r.fullName}`} — {r.errors.join("; ")}
                  </span>
                </li>
              ))}
              {invalidRows.length > 50 && (
                <li className="text-muted-foreground px-4 py-2.5 text-sm sm:px-5">
                  e mais {invalidRows.length - 50} linhas com problema.
                </li>
              )}
            </ul>
          )}
          <ul className="max-h-96 overflow-y-auto">
            {valid.slice(0, 200).map((r) => {
              const roleMissing =
                !createRoles &&
                !!r.jobRole &&
                unknownKeys.has(r.jobRole.toLowerCase());
              return (
                <li
                  key={r.line}
                  className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
                >
                  {roleMissing ? (
                    <AlertTriangle className="text-status-atencao-foreground size-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="text-status-ok-foreground size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    <strong>{r.fullName}</strong>{" "}
                    <span className="text-muted-foreground">
                      · {maskCpfPartial(r.cpf)}
                      {r.jobRole && ` · ${r.jobRole}`}
                      {roleMissing && " (cargo novo)"}
                      {r.sector && ` · ${r.sector}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
            <p className="text-muted-foreground text-sm">
              Setores que ainda não existem são criados. CPFs e matrículas já
              cadastrados são pulados e aparecem no relatório.
            </p>
            <Button
              onClick={submit}
              disabled={isPending || toImport === 0}
              className="rounded-full px-5 font-bold"
            >
              {isPending && <Loader2 className="animate-spin" />}
              Importar {toImport}{" "}
              {toImport === 1 ? "funcionário" : "funcionários"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
