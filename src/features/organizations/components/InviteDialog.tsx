"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/shared/native-select";
import { FormError } from "@/components/shared/form-alert";
import { createInvite } from "@/features/organizations/actions";

export function InviteDialog({
  orgSlug,
  roleOptions,
}: {
  orgSlug: string;
  roleOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    url: string;
    emailed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await createInvite(orgSlug, {
        email: data.get("email"),
        role: data.get("role"),
      });
      if (!r.ok) {
        setError(r.fieldErrors?.email?.[0] ?? r.error);
        return;
      }
      setResult(r.data);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">
          <UserPlus /> Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para a equipe</DialogTitle>
          <DialogDescription>
            A pessoa entra com uma conta do mesmo e-mail. O convite vale 7 dias.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className="text-sm">
              {result.emailed
                ? "Enviamos o convite por e-mail. Você também pode copiar o link:"
                : "Copie o link e envie para a pessoa:"}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={result.url}
                className="font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                size="icon"
                variant="outline"
                className="shrink-0 rounded-full"
                aria-label="Copiar link"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.url);
                  setCopied(true);
                  toast.success("Link copiado");
                }}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="pessoa@empresa.com.br"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Papel</Label>
              <NativeSelect
                id="invite-role"
                name="role"
                defaultValue="storekeeper"
              >
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <FormError message={error} />
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-full font-bold"
            >
              {isPending && <Loader2 className="animate-spin" />}
              Gerar convite
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
