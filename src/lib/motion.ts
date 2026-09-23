import type { CSSProperties } from "react";

/** Índice de escalonamento para a utility `stagger` (80ms por passo). */
export function staggerStyle(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}
