"use client";

import { Pencil, Plus, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogForm } from "@/components/shared/dialog-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Panel, PanelHeader } from "@/components/shared/panel";
import {
  addVariant,
  archiveVariant,
  updateVariant,
} from "@/features/epis/actions";

type Variant = {
  id: string;
  size_label: string;
  sku: string | null;
  min_stock: number;
};

export function VariantsPanel({
  orgSlug,
  epiId,
  variants,
  canEdit,
  unitOfMeasure,
}: {
  orgSlug: string;
  epiId: string;
  variants: Variant[];
  canEdit: boolean;
  unitOfMeasure: string;
}) {
  const fields = (v?: Variant) => [
    {
      name: "sizeLabel",
      label: "Tamanho",
      required: true,
      placeholder: "Ex.: M, 40, Único",
      defaultValue: v?.size_label,
    },
    {
      name: "minStock",
      label: "Estoque mínimo",
      type: "number" as const,
      required: true,
      inputMode: "numeric" as const,
      defaultValue: String(v?.min_stock ?? 0),
      description: "Abaixo disso, o item entra nos alertas de reposição.",
    },
    { name: "sku", label: "Código interno (SKU)", defaultValue: v?.sku ?? "" },
  ];

  return (
    <Panel>
      <PanelHeader
        title="Tamanhos"
        description="O estoque e as entregas são controlados por tamanho."
        actions={
          canEdit && (
            <DialogForm
              trigger={
                <Button size="sm" variant="outline" className="rounded-full">
                  <Plus /> Tamanho
                </Button>
              }
              title="Adicionar tamanho"
              fields={fields()}
              submitLabel="Adicionar"
              successMessage="Tamanho adicionado"
              action={(values) => addVariant(orgSlug, epiId, values)}
            />
          )
        }
      />
      <ul>
        {variants.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
          >
            <span className="bg-muted flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-bold">
              {v.size_label}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p>
                Mínimo: <strong className="tabular-nums">{v.min_stock}</strong>{" "}
                {unitOfMeasure}
              </p>
              {v.sku && (
                <p className="text-muted-foreground truncate">SKU {v.sku}</p>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <DialogForm
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label={`Editar tamanho ${v.size_label}`}
                    >
                      <Pencil />
                    </Button>
                  }
                  title={`Editar tamanho ${v.size_label}`}
                  fields={fields(v)}
                  submitLabel="Salvar"
                  successMessage="Tamanho atualizado"
                  action={(values) =>
                    updateVariant(orgSlug, epiId, v.id, values)
                  }
                />
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label={`Arquivar tamanho ${v.size_label}`}
                    >
                      <Archive />
                    </Button>
                  }
                  title={`Arquivar o tamanho ${v.size_label}?`}
                  description="Ele deixa de aparecer em novas entradas e entregas. O histórico é mantido."
                  confirmLabel="Arquivar"
                  successMessage="Tamanho arquivado"
                  action={() => archiveVariant(orgSlug, epiId, v.id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
