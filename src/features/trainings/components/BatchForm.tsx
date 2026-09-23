"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/shared/native-select";
import { FormError } from "@/components/shared/form-alert";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/client";
import { addMonthsToDate, formatDate } from "@/lib/format";
import { registerTrainingBatch } from "@/features/trainings/actions";
import {
  TRAINING_STATUS,
  type TrainingStatus,
} from "@/features/trainings/constants";

type TypeOption = {
  id: string;
  name: string;
  validity_months: number | null;
  workload_hours: number | null;
};
type EmployeeOption = {
  id: string;
  name: string;
  detail: string;
  status: TrainingStatus | null;
  required: boolean;
};

const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

export function BatchForm({
  orgSlug,
  orgId,
  types,
  employees,
  selectedTypeId,
  preselectedEmployeeId,
  today,
}: {
  orgSlug: string;
  orgId: string;
  types: TypeOption[];
  employees: EmployeeOption[];
  selectedTypeId?: string;
  preselectedEmployeeId?: string;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<string>>(
    new Set(preselectedEmployeeId ? [preselectedEmployeeId] : []),
  );
  const [filter, setFilter] = useState<"todos" | "pendencias">("todos");
  const [query, setQuery] = useState("");
  const [completedAt, setCompletedAt] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const type = types.find((t) => t.id === selectedTypeId);

  const visible = useMemo(
    () =>
      employees.filter(
        (e) =>
          (filter === "todos" ||
            e.status === "vencido" ||
            e.status === "a_vencer" ||
            (e.status === "pendente" && e.required)) &&
          (!query || e.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [employees, filter, query],
  );

  function chooseType(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (id) p.set("tipo", id);
    else p.delete("tipo");
    router.replace(`${pathname}?${p}`, { scroll: false });
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      let certificatePath: string | undefined;
      if (file) {
        if (file.size > MAX_FILE || !ALLOWED.includes(file.type)) {
          setError("O certificado deve ser PDF, JPG ou PNG de até 10 MB.");
          return;
        }
        const ext =
          file.type === "application/pdf"
            ? "pdf"
            : file.type === "image/png"
              ? "png"
              : "jpg";
        const path = `${orgId}/turmas/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await createClient()
          .storage.from("certificates")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) {
          setError("Não foi possível enviar o certificado. Tente novamente.");
          return;
        }
        certificatePath = path;
      }
      const result = await registerTrainingBatch(orgSlug, {
        trainingTypeId: selectedTypeId ?? "",
        completedAt: String(data.get("completedAt") ?? ""),
        employeeIds: [...selected],
        provider: String(data.get("provider") ?? ""),
        instructor: String(data.get("instructor") ?? ""),
        workloadHours: String(data.get("workloadHours") ?? ""),
        expiresAt: String(data.get("expiresAt") ?? ""),
        certificatePath,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      toast.success(
        `Treinamento registrado para ${result.data.count} ${result.data.count === 1 ? "funcionário" : "funcionários"}`,
      );
      router.push(
        preselectedEmployeeId
          ? `/${orgSlug}/funcionarios/${preselectedEmployeeId}`
          : `/${orgSlug}/treinamentos`,
      );
      router.refresh();
    });
  }

  const suggestedExpiry =
    type?.validity_months && completedAt
      ? addMonthsToDate(completedAt, type.validity_months)
      : null;
  const err = (k: string) => fieldErrors[k]?.map((message) => ({ message }));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Panel className="p-4 sm:p-6">
        <FieldGroup className="grid gap-5 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            data-invalid={!!fieldErrors.trainingTypeId}
          >
            <FieldLabel htmlFor="type">Treinamento</FieldLabel>
            <NativeSelect
              id="type"
              value={selectedTypeId ?? ""}
              onChange={(e) => chooseType(e.target.value)}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>
              {type
                ? type.validity_months
                  ? `Validade de ${type.validity_months} meses.`
                  : "Sem vencimento fixo."
                : "Escolha para ver quem está pendente ou vencido."}
            </FieldDescription>
            <FieldError errors={err("trainingTypeId")} />
          </Field>
          <Field data-invalid={!!fieldErrors.completedAt}>
            <FieldLabel htmlFor="completedAt">Data de conclusão</FieldLabel>
            <Input
              id="completedAt"
              name="completedAt"
              type="date"
              max={today}
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
            />
            <FieldError errors={err("completedAt")} />
          </Field>
          <Field data-invalid={!!fieldErrors.expiresAt}>
            <FieldLabel htmlFor="expiresAt">
              Validade{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </FieldLabel>
            <Input id="expiresAt" name="expiresAt" type="date" />
            <FieldDescription>
              {suggestedExpiry
                ? `Calculada automaticamente: ${formatDate(suggestedExpiry)}. Preencha só para alterar.`
                : "Preencha se o certificado tiver validade própria."}
            </FieldDescription>
            <FieldError errors={err("expiresAt")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="provider">
              Entidade / empresa{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </FieldLabel>
            <Input id="provider" name="provider" placeholder="Ex.: SENAI" />
          </Field>
          <Field>
            <FieldLabel htmlFor="instructor">
              Instrutor{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </FieldLabel>
            <Input id="instructor" name="instructor" />
          </Field>
          <Field data-invalid={!!fieldErrors.workloadHours}>
            <FieldLabel htmlFor="workloadHours">
              Carga horária (h){" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </FieldLabel>
            <Input
              id="workloadHours"
              name="workloadHours"
              inputMode="decimal"
              defaultValue={type?.workload_hours ?? ""}
              key={type?.id}
            />
            <FieldError errors={err("workloadHours")} />
          </Field>
          <Field>
            <FieldLabel>
              Certificado{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </FieldLabel>
            {file ? (
              <div className="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remover arquivo"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="hover:bg-foreground/[0.03] flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm">
                <FileUp className="text-primary size-4" /> PDF, JPG ou PNG até
                10 MB
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            <FieldDescription>
              Um certificado da turma, gravado para todos os participantes.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </Panel>

      <Panel>
        <PanelHeader
          title="Participantes"
          description={`${selected.size} selecionado${selected.size === 1 ? "" : "s"}`}
          actions={
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={filter === "todos" ? "secondary" : "ghost"}
                className="rounded-full"
                onClick={() => setFilter("todos")}
              >
                Todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filter === "pendencias" ? "secondary" : "ghost"}
                className="rounded-full"
                onClick={() => setFilter("pendencias")}
                disabled={!type}
              >
                Vencidos e pendentes
              </Button>
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome"
            className="max-w-xs rounded-full"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() =>
              setSelected((s) => new Set([...s, ...visible.map((e) => e.id)]))
            }
          >
            Selecionar{" "}
            {visible.length === employees.length ? "todos" : "exibidos"}
          </Button>
          {selected.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => setSelected(new Set())}
            >
              Limpar
            </Button>
          )}
        </div>
        <ul className="max-h-[28rem] overflow-y-auto">
          {visible.map((e) => {
            const s = e.status ? TRAINING_STATUS[e.status] : null;
            return (
              <li key={e.id} className="border-b last:border-b-0">
                <Label
                  htmlFor={`emp-${e.id}`}
                  className="hover:bg-foreground/[0.03] flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 font-normal sm:px-5"
                >
                  <Checkbox
                    id={`emp-${e.id}`}
                    checked={selected.has(e.id)}
                    onCheckedChange={() => toggle(e.id)}
                    className="size-5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{e.name}</span>
                    {e.detail && (
                      <span className="text-muted-foreground block truncate text-sm">
                        {e.detail}
                      </span>
                    )}
                  </span>
                  {s && (e.status !== "pendente" || e.required) && (
                    <StatusBadge
                      status={s.status}
                      label={s.label}
                      className="hidden sm:inline-flex"
                    />
                  )}
                </Label>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="text-muted-foreground px-4 py-8 text-center text-sm">
              Ninguém neste filtro.
            </li>
          )}
        </ul>
        <FieldError className="px-4 pb-3" errors={err("employeeIds")} />
      </Panel>

      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !selectedTypeId || selected.size === 0}
          className="rounded-full px-6 font-bold"
        >
          {isPending && <Loader2 className="animate-spin" />}
          Registrar para {selected.size}{" "}
          {selected.size === 1 ? "pessoa" : "pessoas"}
        </Button>
      </div>
      <p className="text-muted-foreground text-center text-xs">
        Os prazos de reciclagem sugeridos são editáveis em Tipos. Confirme-os
        com o responsável técnico.
      </p>
    </form>
  );
}
