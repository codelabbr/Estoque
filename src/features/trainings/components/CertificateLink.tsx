"use client";

import { useTransition } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCertificateUrl } from "@/features/trainings/actions";

export function CertificateLink({
  orgSlug,
  path,
}: {
  orgSlug: string;
  path: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="rounded-full"
      aria-label="Ver certificado"
      title="Ver certificado"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await getCertificateUrl(orgSlug, path);
          if (!result.ok) toast.error(result.error);
          else window.open(result.data.url, "_blank", "noopener");
        })
      }
    >
      {isPending ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
    </Button>
  );
}
