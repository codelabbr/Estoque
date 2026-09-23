"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { FormError } from "@/components/shared/form-alert";
import { maskCpfPartial } from "@/lib/validators";
import { parseEmployeeCsv } from "@/features/employees/csv";
import { importEmployees } from "@/features/employees/actions";

const TEMPLATE =
  "nome;cpf;matricula;cargo;setor;admissao;telefone;email\n" +
  "Ana Souza;529.982.247-25;0001;Soldador;Caldeiraria;05/03/2024;(11) 98765-4321;ana@empresa.com.br\n";

export function ImportEmployees({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(
    () => (text.trim() ? parseEmployeeCsv(text) : null),
    [text],
  );
  const valid = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsed?.rows.filter((r) => r.errors.length > 0) ?? [];

  async function onFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Arquivo maior que 2 MB. Divida a planilha.");
      return;
    }
    const buffer = await file.arrayBuffer();
    // Excel pt-BR costuma salvar CSV em Windows-1252; tenta UTF-8 primeiro.
    let content = new TextDecoder("utf-8").decode(buffer);
    if (content.includes("�"))
      content = new TextDecoder("windows-1252").decode(buffer);
    setError(null);
    setText(content);
  }

  function downloadTemplate() {
    const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-funcionarios.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await importEmployees(
        orgSlug,
        valid.map((r) => ({
          fullName: r.fullName,
          cpf: r.cpf,
          registration: r.registration,
          jobRole: r.jobRole,
          sector: r.sector,
          hiredAt: r.hiredAt,
          phone: r.phone,
          email: r.email,
        })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { inserted, skipped } = result.data;
      toast.success(
        `${inserted} ${inserted === 1 ? "funcionário importado" : "funcionários importados"}` +
          (skipped
            ? ` · ${skipped} já cadastrado${skipped > 1 ? "s" : ""} (ignorado${skipped > 1 ? "s" : ""})`
            : ""),
      );
      router.push(`/${orgSlug}/funcionarios`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <PanelHeader
          title="1. Envie a planilha"
          description="CSV com as colunas nome e cpf (obrigatórias) e, se quiser, matricula, cargo, setor, admissao, telefone e email."
          actions={
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={downloadTemplate}
            >
              <Download /> Modelo
            </Button>
          }
        />
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <label className="hover:bg-foreground/[0.03] flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors">
            <FileUp className="text-primary size-7" aria-hidden="true" />
            <span className="font-bold">Escolher arquivo CSV</span>
            <span className="text-muted-foreground text-sm">
              No Excel: Arquivo → Salvar como → CSV (separado por vírgulas ou
              ponto e vírgula)
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <details>
            <summary className="text-muted-foreground cursor-pointer text-sm">
              Ou cole o conteúdo aqui
            </summary>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
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
            description={`${valid.length} prontas para importar · ${invalidRows.length} com problema`}
          />
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
            </ul>
          )}
          <ul className="max-h-96 overflow-y-auto">
            {valid.slice(0, 200).map((r) => (
              <li
                key={r.line}
                className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0 sm:px-5"
              >
                <CheckCircle2 className="text-status-ok-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  <strong>{r.fullName}</strong>{" "}
                  <span className="text-muted-foreground">
                    · {maskCpfPartial(r.cpf)}
                    {r.jobRole && ` · ${r.jobRole}`}
                    {r.sector && ` · ${r.sector}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
            <p className="text-muted-foreground text-sm">
              Cargos e setores que ainda não existem serão criados. CPFs já
              cadastrados são ignorados.
            </p>
            <Button
              onClick={submit}
              disabled={isPending || valid.length === 0}
              className="rounded-full px-5 font-bold"
            >
              {isPending && <Loader2 className="animate-spin" />}
              Importar {valid.length}{" "}
              {valid.length === 1 ? "funcionário" : "funcionários"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
