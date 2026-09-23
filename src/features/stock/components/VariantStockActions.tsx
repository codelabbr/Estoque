"use client";

import { useState } from "react";
import { MoreHorizontal, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DialogForm } from "@/components/shared/dialog-form";
import { adjustStock, discardStock } from "@/features/stock/actions";

export function VariantStockActions({
  orgSlug,
  locationId,
  variantId,
  label,
  balance,
}: {
  orgSlug: string;
  locationId: string;
  variantId: string;
  label: string;
  balance: number;
}) {
  const [open, setOpen] = useState<"ajuste" | "descarte" | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label={`Ações de estoque: ${label}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen("ajuste")}>
            <SlidersHorizontal /> Ajustar saldo
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpen("descarte")}
            disabled={balance <= 0}
          >
            <Trash2 /> Descartar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {open === "ajuste" && (
        <DialogForm
          defaultOpen
          onOpenChange={(v) => !v && setOpen(null)}
          trigger={<span hidden />}
          title={`Ajustar saldo · ${label}`}
          description={`Saldo atual: ${balance}. Use para corrigir diferenças; fica registrado com seu usuário.`}
          fields={[
            {
              name: "direction",
              label: "Tipo de ajuste",
              type: "select",
              required: true,
              defaultValue: "entrada",
              options: [
                { value: "entrada", label: "Somar ao saldo" },
                { value: "saida", label: "Subtrair do saldo" },
              ],
            },
            {
              name: "quantity",
              label: "Quantidade",
              type: "number",
              required: true,
              inputMode: "numeric",
            },
            {
              name: "reason",
              label: "Motivo",
              type: "textarea",
              required: true,
              placeholder: "Ex.: diferença na contagem",
            },
          ]}
          submitLabel="Registrar ajuste"
          successMessage="Ajuste registrado"
          action={(values) =>
            adjustStock(orgSlug, { ...values, locationId, variantId })
          }
        />
      )}
      {open === "descarte" && (
        <DialogForm
          defaultOpen
          onOpenChange={(v) => !v && setOpen(null)}
          trigger={<span hidden />}
          title={`Descartar · ${label}`}
          description={`Saldo atual: ${balance}. Para itens vencidos, danificados ou impróprios para uso.`}
          fields={[
            {
              name: "quantity",
              label: "Quantidade",
              type: "number",
              required: true,
              inputMode: "numeric",
            },
            {
              name: "reason",
              label: "Motivo",
              type: "textarea",
              required: true,
              placeholder: "Ex.: lote vencido",
            },
          ]}
          submitLabel="Registrar descarte"
          successMessage="Descarte registrado"
          action={(values) =>
            discardStock(orgSlug, { ...values, locationId, variantId })
          }
        />
      )}
    </>
  );
}
