import { ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <div className="text-primary flex items-center gap-2">
        <ShieldCheck className="size-7" />
        <span className="text-lg font-semibold">Almox SST</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
