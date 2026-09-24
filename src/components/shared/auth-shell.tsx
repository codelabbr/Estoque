import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  FileSignature,
  AlertTriangle,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { staggerStyle } from "@/lib/motion";

const HIGHLIGHTS = [
  {
    icon: FileSignature,
    title: "Entrega com assinatura digital",
    description: "Ficha de EPI gerada na hora, com validade jurídica.",
  },
  {
    icon: Clock,
    title: "Vencimentos sob controle",
    description: "CA, treinamentos e estoque mínimo com alerta antecipado.",
  },
  {
    icon: CheckCircle2,
    title: "Pronto para a fiscalização",
    description: "Dossiê por funcionário em um clique, conforme NR-6.",
  },
];

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative isolate flex flex-col px-4 py-6 sm:px-10 sm:py-8">
        <div
          aria-hidden="true"
          className="animate-fade-in from-primary/[0.07] absolute inset-0 -z-10 bg-radial-[ellipse_at_top_left] via-transparent to-transparent"
        />
        <Link
          href="/"
          className="animate-fade-in w-fit"
          aria-label="Almox SST — início"
        >
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            <div
              className="animate-fade-up stagger mb-8 space-y-2"
              style={staggerStyle(1)}
            >
              <h1 className="text-2xl font-semibold sm:text-[1.75rem]">
                {title}
              </h1>
              {description && (
                <p className="text-muted-foreground text-[15px] leading-relaxed text-pretty">
                  {description}
                </p>
              )}
            </div>
            <div className="animate-fade-up stagger" style={staggerStyle(2)}>
              {children}
            </div>
            {footer && (
              <div
                className="text-muted-foreground animate-fade-up stagger mt-8 text-center text-sm"
                style={staggerStyle(3)}
              >
                {footer}
              </div>
            )}
          </div>
        </div>
        <p className="text-muted-foreground animate-fade-in text-xs">
          © {new Date().getFullYear()} Almox SST ·{" "}
          <Link href="/termos" className="hover:underline">
            Termos
          </Link>{" "}
          ·{" "}
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
        </p>
      </div>
      <BrandPanel />
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[oklch(0.155_0.012_150)] p-10 text-white lg:flex lg:flex-col xl:p-14">
      <div
        aria-hidden="true"
        className="absolute inset-0 [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)] [background-size:40px_40px] opacity-[0.05]"
      />
      <div
        aria-hidden="true"
        className="animate-glow absolute -top-40 -right-40 size-[520px] rounded-full bg-[oklch(0.77_0.2_134)] opacity-15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="animate-glow absolute -bottom-48 -left-24 size-[420px] rounded-full bg-[oklch(0.5_0.12_150)] opacity-20 blur-3xl [animation-direction:alternate-reverse]"
      />

      <div className="relative flex flex-1 flex-col justify-center gap-12">
        <div
          className="animate-fade-up stagger max-w-md space-y-4"
          style={staggerStyle(2)}
        >
          <p className="text-sm font-medium tracking-wide text-white/60 uppercase">
            Gestão de SST para a indústria
          </p>
          <h2 className="text-3xl leading-tight font-semibold text-balance xl:text-4xl">
            EPIs, estoque e treinamentos em um só lugar.
          </h2>
        </div>

        <div className="animate-fade-up stagger" style={staggerStyle(4)}>
          <div className="animate-float">
            <PreviewCard />
          </div>
        </div>

        <ul className="grid max-w-md gap-5">
          {HIGHLIGHTS.map(({ icon: Icon, title, description }, i) => (
            <li
              key={title}
              className="animate-fade-up stagger flex gap-3.5"
              style={staggerStyle(6 + i)}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-white/60">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

const PREVIEW_ROWS = [
  { name: "Ana Souza", item: "Luva nitrílica", status: "ok" },
  { name: "Carlos Lima", item: "NR-35 · vence em 12 dias", status: "atencao" },
  {
    name: "João Pereira",
    item: "Protetor auricular · CA vencido",
    status: "irregular",
  },
] as const;

const PREVIEW_STATUS = {
  ok: {
    label: "Em dia",
    icon: CheckCircle2,
    className: "bg-emerald-400/15 text-emerald-200",
  },
  atencao: {
    label: "Atenção",
    icon: Clock,
    className: "bg-amber-400/15 text-amber-200",
  },
  irregular: {
    label: "Irregular",
    icon: AlertTriangle,
    className: "bg-rose-400/15 text-rose-200",
  },
};

function PreviewCard() {
  return (
    <div
      aria-hidden="true"
      className="max-w-md rounded-2xl bg-white/[0.06] p-2 ring-1 ring-white/10 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-3">
        <p className="text-sm font-medium">Conformidade da equipe</p>
        <p className="text-xs text-white/50">Hoje</p>
      </div>
      <ul className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.04]">
        {PREVIEW_ROWS.map((row, i) => {
          const s = PREVIEW_STATUS[row.status];
          return (
            <li
              key={row.name}
              className="animate-fade-up stagger flex items-center gap-3 px-3 py-2.5"
              style={staggerStyle(5 + i)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                {row.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{row.name}</p>
                <p className="truncate text-xs text-white/50">{row.item}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
              >
                <s.icon className="size-3" />
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
