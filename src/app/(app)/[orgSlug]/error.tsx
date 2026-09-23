"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={AlertTriangle}
      title="Algo deu errado"
      description="Não foi possível carregar esta página. Tente novamente."
      className="[&_svg]:text-destructive"
      action={
        <Button onClick={() => reset()}>
          <RotateCcw aria-hidden="true" />
          Tentar novamente
        </Button>
      }
    />
  );
}
