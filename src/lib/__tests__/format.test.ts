import { describe, expect, it } from "vitest";
import {
  addDaysToDate,
  addMonthsToDate,
  daysUntil,
  describeDue,
  formatCurrency,
  formatDate,
  formatDateTime,
  todayInSaoPaulo,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("formata número como BRL", () => {
    expect(formatCurrency(1234.56)).toBe("R$\u00a01.234,56");
  });
});

describe("formatDate", () => {
  it("data de calendário não sofre conversão de fuso", () => {
    expect(formatDate("2026-09-23")).toBe("23/09/2026");
  });

  it("timestamp é exibido no fuso de São Paulo", () => {
    // 02:00 UTC = 23:00 do dia anterior em São Paulo
    expect(formatDate("2026-03-05T02:00:00Z")).toBe("04/03/2026");
  });
});

describe("formatDateTime", () => {
  it("formata data e hora com 'às' em São Paulo", () => {
    expect(formatDateTime("2026-03-05T15:30:00Z")).toBe("05/03/2026 às 12:30");
  });
});

describe("datas de calendário", () => {
  const now = new Date("2026-09-23T15:00:00Z");

  it("hoje considera o fuso de São Paulo", () => {
    expect(todayInSaoPaulo(new Date("2026-09-24T01:00:00Z"))).toBe(
      "2026-09-23",
    );
  });

  it("calcula dias até o vencimento", () => {
    expect(daysUntil("2026-10-05", now)).toBe(12);
    expect(daysUntil("2026-09-20", now)).toBe(-3);
  });

  it("descreve o vencimento em pt-BR", () => {
    expect(describeDue("2026-10-05", now)).toBe("vence em 12 dias");
    expect(describeDue("2026-09-23", now)).toBe("vence hoje");
    expect(describeDue("2026-09-20", now)).toBe("venceu há 3 dias");
  });

  it("soma meses respeitando o fim do mês", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsToDate("2026-09-23", 24)).toBe("2028-09-23");
  });

  it("soma dias", () => {
    expect(addDaysToDate("2026-12-30", 3)).toBe("2027-01-02");
  });
});
