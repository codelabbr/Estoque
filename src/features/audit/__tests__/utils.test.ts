import { describe, expect, it } from "vitest";
import { diffAudit, formatAuditValue, maskSensitive } from "../utils";

describe("maskSensitive", () => {
  it("mascara CPF e mantém o resto", () => {
    expect(
      maskSensitive({
        full_name: "Ana",
        cpf: "52998224725",
        employee_cpf_snapshot: "52998224725",
      }),
    ).toEqual({
      full_name: "Ana",
      cpf: "***.982.247-**",
      employee_cpf_snapshot: "***.982.247-**",
    });
    expect(maskSensitive(null)).toBeNull();
  });
});

describe("diffAudit", () => {
  it("lista só os campos que mudaram, ignorando colunas técnicas", () => {
    expect(
      diffAudit(
        {
          quantity: 1,
          replacement_days: null,
          mandatory: true,
          updated_at: "a",
        },
        { quantity: 2, replacement_days: 15, mandatory: true, updated_at: "b" },
      ),
    ).toEqual([
      { field: "quantity", before: 1, after: 2 },
      { field: "replacement_days", before: null, after: 15 },
    ]);
  });

  it("insert e delete não têm diferença (mostram o registro inteiro)", () => {
    expect(diffAudit(null, { a: 1 })).toEqual([]);
    expect(diffAudit({ a: 1 }, null)).toEqual([]);
  });
});

describe("formatAuditValue", () => {
  it("resume valores para leitura", () => {
    expect(formatAuditValue(null)).toBe("vazio");
    expect(formatAuditValue(true)).toBe("sim");
    expect(formatAuditValue("x".repeat(80))).toHaveLength(58);
    expect(formatAuditValue({ epi: "Luva" })).toBe('{"epi":"Luva"}');
  });
});
