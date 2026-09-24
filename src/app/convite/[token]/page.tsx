import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailX, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/shared/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";
import { ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { AcceptInviteButton } from "./accept-button";

export const metadata: Metadata = {
  title: "Convite — Almox SST",
  robots: { index: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/convite/${token}`);

  const { data, error } = await supabase.rpc("get_invite", { p_token: token });
  const invite = data as {
    organization_name: string;
    email: string;
    role: OrgRole;
    expires_at: string;
  } | null;

  if (error || !invite) {
    return (
      <AuthShell
        title="Convite indisponível"
        description={error ? mapDbError(error) : "Convite inválido."}
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <MailX className="text-muted-foreground size-10" />
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/">Ir para o início</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const sameEmail = user.email?.toLowerCase() === invite.email.toLowerCase();
  return (
    <AuthShell
      title={`Entrar em ${invite.organization_name}`}
      description={`Você foi convidado como ${ROLE_LABELS[invite.role]}. Convite válido até ${formatDate(invite.expires_at)}.`}
    >
      {sameEmail ? (
        <AcceptInviteButton token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Este convite foi enviado para <strong>{invite.email}</strong>, mas
            você entrou como <strong>{user.email}</strong>. Saia e entre (ou
            crie a conta) com o e-mail convidado.
          </p>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/login?next=/convite/${token}`}>
              <UserPlus /> Entrar com outra conta
            </Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
