"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/shared/native-select";

export function LocationSwitcher({
  locations,
  currentId,
}: {
  locations: { id: string; name: string; is_default: boolean }[];
  currentId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="w-48">
      <NativeSelect
        aria-label="Local de estoque"
        value={currentId}
        className="rounded-full"
        onChange={(e) => {
          const p = new URLSearchParams(searchParams.toString());
          const loc = locations.find((l) => l.id === e.target.value);
          if (loc?.is_default) p.delete("local");
          else p.set("local", e.target.value);
          router.push(`${pathname}${p.size ? `?${p}` : ""}`);
        }}
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
