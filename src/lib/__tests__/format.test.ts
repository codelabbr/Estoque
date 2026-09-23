import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

describe("formatCurrency", () => {
  it("formata número como BRL", () => {
    expect(formatCurrency(1234.56)).toBe("R$ 1.234,56");
  });
});

describe("formatDate", () => {
  it("formata data como dd/MM/yyyy", () => {
    expect(formatDate("2026-03-05T12:00:00Z")).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });
});

describe("formatDateTime", () => {
  it("formata data e hora com 'às'", () => {
    expect(formatDateTime("2026-03-05T12:00:00Z")).toContain("às");
  });
});
