"use client";

import { Input } from "@/components/ui/input";

export function maskCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Input de CPF com máscara 000.000.000-00. O valor salvo é normalizado no schema. */
export function CpfInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="off"
      placeholder="000.000.000-00"
      value={maskCpf(value)}
      onChange={(e) => onChange(maskCpf(e.target.value))}
      {...props}
    />
  );
}
