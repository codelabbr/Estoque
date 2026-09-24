"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadDemoData } from "@/features/organizations/actions";

export function LoadDemoButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <div className="border-t px-4 py-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full rounded-full"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await loadDemoData(orgSlug);
            if (!r.ok) toast.error(r.error);
            else {
              toast.success("Dados de exemplo carregados");
              router.refresh();
            }
          })
        }
      >
        {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Carregar dados de exemplo
      </Button>
      <p className="text-muted-foreground mt-1 text-center text-xs">
        8 funcionários, 6 EPIs, estoque, entregas e treinamentos fictícios para
        explorar o sistema.
      </p>
    </div>
  );
}
