"use client";

import { Repeat, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogForm } from "@/components/shared/dialog-form";
import { returnItem } from "@/features/deliveries/actions";

export function HoldingActions({
  orgSlug,
  itemId,
  employeeId,
  label,
}: {
  orgSlug: string;
  itemId: string;
  employeeId: string;
  label: string;
}) {
  return (
    <div className="flex gap-1">
      <DialogForm
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label={`Trocar ${label}`}
            title="Trocar"
          >
            <Repeat />
          </Button>
        }
        title={`Trocar ${label}`}
        description="Registra a devolução do item atual e abre o balcão para entregar o novo."
        fields={[
          {
            name: "destination",
            label: "O item devolvido vai para",
            type: "select",
            required: true,
            defaultValue: "descarte",
            options: [
              { value: "descarte", label: "Descarte (danificado/vencido)" },
              { value: "estoque", label: "Estoque (em bom estado)" },
            ],
          },
          { name: "notes", label: "Observação", placeholder: "Ex.: rasgada" },
        ]}
        submitLabel="Devolver e entregar novo"
        successMessage="Devolução registrada"
        redirectTo={`/${orgSlug}/entregas/nova?funcionario=${employeeId}`}
        action={(values) => returnItem(orgSlug, itemId, employeeId, values)}
      />
      <DialogForm
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label={`Devolver ${label}`}
            title="Devolver"
          >
            <Undo2 />
          </Button>
        }
        title={`Devolver ${label}`}
        fields={[
          {
            name: "destination",
            label: "Destino",
            type: "select",
            required: true,
            defaultValue: "estoque",
            options: [
              { value: "estoque", label: "Volta para o estoque" },
              { value: "descarte", label: "Descarte" },
            ],
          },
          { name: "notes", label: "Observação" },
        ]}
        submitLabel="Registrar devolução"
        successMessage="Devolução registrada"
        action={(values) => returnItem(orgSlug, itemId, employeeId, values)}
      />
    </div>
  );
}
