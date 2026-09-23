"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { SignatureCapture } from "@/features/deliveries/components/SignatureCapture";
import { signByToken } from "@/features/deliveries/public-actions";

export function PublicSignForm({
  token,
  request,
}: {
  token: string;
  request: {
    first_name: string;
    term: string;
    items: { epi: string; size: string; quantity: number; ca: string | null }[];
  };
}) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div
        className="animate-fade-up flex flex-col items-center gap-3 py-12 text-center"
        role="status"
      >
        <CheckCircle2 className="text-status-ok-foreground size-14" />
        <h2 className="text-2xl font-extrabold">Recebimento confirmado</h2>
        <p className="text-muted-foreground">
          Obrigado, {request.first_name}. Pode fechar esta página.
        </p>
      </div>
    );
  }

  return (
    <SignatureCapture
      term={request.term}
      items={request.items}
      employeeName={request.first_name}
      onSubmit={async (input) => {
        const result = await signByToken(token, input);
        if (result.ok) setDone(true);
        return result;
      }}
    />
  );
}
