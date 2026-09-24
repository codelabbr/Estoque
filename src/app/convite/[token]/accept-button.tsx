"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/shared/form-alert";
import { acceptInvite } from "@/features/organizations/actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      <Button
        size="lg"
        className="rounded-full font-bold"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await acceptInvite(token);
            if (!r.ok) setError(r.error);
            else router.replace(`/${r.data.slug}/dashboard`);
          })
        }
      >
        {isPending && <Loader2 className="animate-spin" />}
        Aceitar convite
      </Button>
    </div>
  );
}
