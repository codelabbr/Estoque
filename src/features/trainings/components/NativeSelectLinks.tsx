"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/shared/native-select";

/** Select que navega para um link por opção (filtros na URL). */
export function NativeSelectLinks({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <div className="w-full sm:w-56">
      <NativeSelect
        aria-label={label}
        value={value}
        className="rounded-full"
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value);
          if (opt) router.push(opt.href, { scroll: false });
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
