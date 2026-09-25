"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { FormError } from "@/components/shared/form-alert";
import { MAX_SPREADSHEET_BYTES, readSpreadsheetFile } from "@/lib/spreadsheet";
import { parseJobRoleTable } from "@/features/structure/import";
import { importJobRoles } from "@/features/structure/actions";

const TEMPLATE =
  "nome;cbo;descricao\n" +
  "Soldador;7243-15;Solda em caldeiraria\n" +
  "Eletricista de manutenção;7156-10;Trabalha com NR-10\n";

function downloadTemplate() {
  const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-cargos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportJobRoles({
  orgSlug,
  existingJobRoles,
}: {
  orgSlug: string;
  existingJobRoles: string[];
}) {
  const router = useRouter();
  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<{
    inserted: number;
    skipped: string[];
  } | null>(null);

  const parsed = useMemo(
    () => (table ? parseJobRoleTable(table, existingJobRoles) : null),
    [table, existingJobRoles],
  );
  const invalid = parsed?.rows.filter((r) => r.errors.length > 0) ?? [];
  const existing =
    parsed?.rows.filter((r) => r.errors.length === 0 && r.exists) ?? [];
  const toImport =
    parsed?.rows.filter((r) => r.errors.length === 0 && !r.exists) ?? [];

  async function onFile(file: File) {
    setError(null);
    setDone(null);
    if (file.size > MAX_SPREADSHEET_BYTES) {
      setError("Arquivo maior que 2 MB.");
      return;
    }
    setReading(true);
    try {
      setTable(await readSpreadsheetFile(file));
      setFileName(file.name);
    } catch {
      setError("Não foi possível ler o arquivo. Use CSV ou XLSX (Excel).");
    } finally {
      setReading(false);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await importJobRoles(
        orgSlug,
        toImport.map(({ name, cbo, description }) => ({
          name,
          cbo,
          description,
        })),
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(r.data);
      toast.success(
        `${r.data.inserted} ${r.data.inserted === 1 ? "cargo importado" : "cargos importados"}`,
      );
      router.refresh();
    });
  }

  if (done) {
    return (
      <Panel className="animate-fade-up">
        <PanelHeader
          title="Importação concluída"
          description={`${done.inserted} cargos criados${done.skipped.length ? ` · ${done.skipped.length} já existiam` : ""}`}
        />
        <p className="text-muted-foreground px-4 py-4 text-sm sm:px-5">
          Próximo passo: abra cada cargo e monte a matriz de EPIs e treinamentos
          obrigatórios.
        </p>
        <div className="flex justify-end border-t px-4 py-3 sm:px-5">
          <Button asChild className="rounded-full font-bold">
            <Link href={`/${orgSlug}/cargos`}>Ver cargos</Link>
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
          description="CSV ou Excel (XLSX) com a coluna nome e, se quiser, cbo e descricao."
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
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          {parsed?.missingColumns.length ? (
            <FormError message="A planilha precisa da coluna nome." />
          ) : null}
          <FormError message={error} />
        </div>
      </Panel>

      {parsed && parsed.rows.length > 0 && (
        <Panel className="animate-fade-up">
          <PanelHeader
            title="2. Confira"
            description={`${toImport.length} novos · ${existing.length} já existem · ${invalid.length} com problema`}
          />
          <ul className="max-h-96 overflow-y-auto">
            {parsed.rows.map((r) => (
              <li
                key={r.line}
                className="flex items-start gap-3 border-b px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
              >
                {r.errors.length ? (
                  <AlertTriangle className="text-status-irregular-foreground mt-0.5 size-4 shrink-0" />
                ) : r.exists ? (
                  <MinusCircle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="text-status-ok-foreground mt-0.5 size-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <strong>Linha {r.line}</strong> · {r.name || "(sem nome)"}
                  {r.cbo && (
                    <span className="text-muted-foreground">
                      {" "}
                      · CBO {r.cbo}
                    </span>
                  )}
                  {r.errors.length > 0 && (
                    <span className="text-status-irregular-foreground">
                      {" "}
                      — {r.errors.join("; ")}
                    </span>
                  )}
                  {r.errors.length === 0 && r.exists && (
                    <span className="text-muted-foreground">
                      {" "}
                      — já existe, será pulado
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t px-4 py-3 sm:px-5">
            <Button
              onClick={submit}
              disabled={isPending || toImport.length === 0}
              className="rounded-full px-5 font-bold"
            >
              {isPending && <Loader2 className="animate-spin" />}
              Importar {toImport.length}{" "}
              {toImport.length === 1 ? "cargo" : "cargos"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
