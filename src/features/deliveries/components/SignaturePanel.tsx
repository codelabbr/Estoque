"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { formatDateTime } from "@/lib/format";
import {
  createSignatureLink,
  signInPerson,
} from "@/features/deliveries/actions";
import { SignatureCapture } from "./SignatureCapture";

export function SignaturePanel({
  orgSlug,
  deliveryId,
  employeeName,
  term,
  items,
  openRequest,
  autoOpen = false,
}: {
  orgSlug: string;
  deliveryId: string;
  employeeName: string;
  term: string;
  items: { epi: string; size: string; quantity: number; ca: string | null }[];
  openRequest: { channel: string; expires_at: string } | null;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [signOpen, setSignOpen] = useState(autoOpen);
  const [link, setLink] = useState<{
    url: string;
    whatsappUrl: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generateLink() {
    startTransition(async () => {
      const result = await createSignatureLink(orgSlug, deliveryId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(result.data);
      router.refresh();
    });
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Panel className="animate-fade-up border-primary/40">
      <PanelHeader
        title="Assinatura do funcionário"
        description="Escolha como o funcionário vai confirmar o recebimento."
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <Button
          size="lg"
          className="h-14 rounded-2xl text-base font-bold"
          onClick={() => setSignOpen(true)}
        >
          <PenLine /> Assinar agora
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 rounded-2xl text-base"
          disabled={isPending}
          onClick={generateLink}
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
          {openRequest || link ? "Gerar novo link" : "Enviar link"}
        </Button>
      </div>

      {link && (
        <div
          className="flex flex-col gap-3 border-t px-4 py-4 sm:px-5"
          aria-live="polite"
        >
          <p className="text-sm font-bold">
            Link de assinatura (válido por 72 horas)
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={link.url}
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 rounded-full"
              onClick={copy}
              aria-label="Copiar link"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          {link.whatsappUrl ? (
            <Button
              asChild
              className="rounded-full bg-[#25D366] font-bold text-white hover:bg-[#1ebe5b]"
            >
              <a href={link.whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle /> Enviar pelo WhatsApp
              </a>
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">
              Cadastre o celular do funcionário para enviar direto pelo
              WhatsApp.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Gerar um novo link invalida o anterior. O link só funciona uma vez.
          </p>
        </div>
      )}
      {!link && openRequest && (
        <p className="text-muted-foreground border-t px-4 py-3 text-sm sm:px-5">
          Há um link ativo até {formatDateTime(openRequest.expires_at)}. Por
          segurança, ele não é exibido de novo; gere outro se precisar reenviar.
        </p>
      )}

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Assinatura de {employeeName.split(" ")[0]}
            </DialogTitle>
            <DialogDescription>
              Entregue o aparelho ao funcionário para conferir e assinar.
            </DialogDescription>
          </DialogHeader>
          <SignatureCapture
            term={term}
            items={items}
            employeeName={employeeName}
            onSubmit={async (input) => {
              const result = await signInPerson(orgSlug, deliveryId, input);
              if (result.ok) {
                toast.success("Entrega assinada");
                setSignOpen(false);
                router.replace(`/${orgSlug}/entregas/${deliveryId}`);
                router.refresh();
              }
              return result;
            }}
          />
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
