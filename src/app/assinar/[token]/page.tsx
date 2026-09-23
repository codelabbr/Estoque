import type { Metadata } from "next";
import { Clock, LinkIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { PublicSignForm } from "./public-sign-form";

export const metadata: Metadata = {
  title: "Assinar entrega de EPI — Almox SST",
  robots: { index: false, follow: false },
};

type RequestData = {
  organization_name: string;
  first_name: string;
  cpf_masked: string;
  delivered_at: string;
  term: string;
  expires_at: string;
  items: { epi: string; size: string; quantity: number; ca: string | null }[];
};

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_signature_request", {
    p_token: token,
  });
  const request = data as RequestData | null;

  return (
    <div className="bg-background min-h-svh">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Logo />
        <span className="text-muted-foreground text-xs">Assinatura segura</span>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
        {error || !request ? (
          <div className="animate-fade-up flex flex-col items-center gap-3 py-16 text-center">
            <span className="bg-muted flex size-14 items-center justify-center rounded-full">
              {error?.message.includes("expirado") ? (
                <Clock className="size-6" />
              ) : (
                <LinkIcon className="size-6" />
              )}
            </span>
            <h1 className="text-xl font-extrabold">
              Não foi possível abrir este link
            </h1>
            <p className="text-muted-foreground max-w-sm">
              {error ? mapDbError(error) : "Link de assinatura inválido."}
            </p>
          </div>
        ) : (
          <>
            <div className="animate-fade-up space-y-1">
              <p className="text-muted-foreground text-sm">
                {request.organization_name}
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Olá, {request.first_name}!
              </h1>
              <p className="text-muted-foreground text-[15px]">
                Confira os EPIs entregues em{" "}
                {formatDateTime(request.delivered_at)} e assine para confirmar o
                recebimento. CPF {request.cpf_masked}.
              </p>
            </div>
            <PublicSignForm token={token} request={request} />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Seus dados são tratados por {request.organization_name} para
              cumprir obrigações de segurança do trabalho (NR-6), conforme a
              LGPD. Este link vale até {formatDateTime(request.expires_at)} e só
              pode ser usado uma vez.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
