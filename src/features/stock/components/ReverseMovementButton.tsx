"use client";

import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogForm } from "@/components/shared/dialog-form";
import { reverseMovement } from "@/features/stock/actions";

export function ReverseMovementButton({
  orgSlug,
  movementId,
  label,
}: {
  orgSlug: string;
  movementId: string;
  label: string;
}) {
  return (
    <DialogForm
      trigger={
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          aria-label={`Estornar ${label}`}
        >
          <Undo2 />
        </Button>
      }
      title="Estornar movimento"
      description={`${label}. O estorno cria um lançamento contrário; o original continua no histórico.`}
      fields={[
        {
          name: "reason",
          label: "Motivo do estorno",
          type: "textarea",
          required: true,
          placeholder: "Ex.: lançado em duplicidade",
        },
      ]}
      submitLabel="Estornar"
      successMessage="Movimento estornado"
      action={(values) => reverseMovement(orgSlug, movementId, values)}
    />
  );
}
