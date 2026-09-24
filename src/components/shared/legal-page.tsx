import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-svh">
      <header className="border-b px-4 py-3">
        <Link href="/" aria-label="Almox SST — início" className="w-fit">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div
          className="bg-status-atencao text-status-atencao-foreground mb-8 flex gap-3 rounded-2xl p-4 text-sm"
          role="note"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Rascunho — revisar com advogado antes de publicar.</strong>{" "}
            Este texto é um ponto de partida e ainda não tem validade jurídica.
          </p>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Última atualização: {updatedAt}
        </p>
        <article className="mt-8 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </article>
      </main>
    </div>
  );
}
