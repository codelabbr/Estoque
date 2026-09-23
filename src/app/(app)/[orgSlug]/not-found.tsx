import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function OrgNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Não encontrado"
      description="O registro não existe, foi arquivado ou você não tem acesso a ele."
      action={
        <Button asChild className="rounded-full">
          <Link href="/">Voltar ao início</Link>
        </Button>
      }
    />
  );
}
