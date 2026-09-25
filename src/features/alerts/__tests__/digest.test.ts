import { describe, expect, it } from "vitest";
import {
  buildDigest,
  DEFAULT_ALERT_SETTINGS,
  digestSubject,
  newIrregulars,
  type DigestAlert,
} from "../digest";

const due = (d: string) => `vence ${d}`;

const alerts: DigestAlert[] = [
  {
    alert_key: "ca:1",
    kind: "ca_vencido",
    severity: "critico",
    due_date: "2026-01-01",
    title: "Máscara",
  },
  {
    alert_key: "ca:2",
    kind: "ca_a_vencer",
    severity: "atencao",
    due_date: "2026-10-10",
    title: "Cinto",
  },
  {
    alert_key: "estoque:1",
    kind: "estoque_minimo",
    severity: "atencao",
    due_date: null,
    title: "Luva G",
  },
  {
    alert_key: "tr:1",
    kind: "treinamento_vencido",
    severity: "critico",
    due_date: "2026-09-01",
    title: "NR-35 · Fábio",
  },
];

describe("buildDigest", () => {
  it("monta uma seção por tipo ativado, críticos primeiro", () => {
    const d = buildDigest(alerts, DEFAULT_ALERT_SETTINGS, [], due)!;
    expect(d.sections.map((s) => s.label)).toEqual([
      "CA de EPI",
      "Treinamentos",
      "Estoque crítico",
    ]);
    expect(d.sections[0].items.map((i) => i.title)).toEqual([
      "Máscara",
      "Cinto",
    ]);
    expect(d).toMatchObject({ criticalCount: 2, attentionCount: 2 });
  });

  it("respeita os tipos desligados", () => {
    const d = buildDigest(
      alerts,
      { ...DEFAULT_ALERT_SETTINGS, notify_ca: false, notify_stock: false },
      [],
      due,
    )!;
    expect(d.sections.map((s) => s.label)).toEqual(["Treinamentos"]);
    expect(d.contentKeys).toEqual(["tr:1"]);
  });

  it("resumo desligado ou sem conteúdo não gera e-mail", () => {
    expect(
      buildDigest(
        alerts,
        { ...DEFAULT_ALERT_SETTINGS, enabled: false },
        [],
        due,
      ),
    ).toBeNull();
    expect(buildDigest([], DEFAULT_ALERT_SETTINGS, [], due)).toBeNull();
  });

  it("irregulares novos vêm primeiro e entram no conteúdo", () => {
    const d = buildDigest(
      [],
      DEFAULT_ALERT_SETTINGS,
      [{ employeeId: "e1", name: "Ana", reason: "Troca de EPI vencida" }],
      due,
    )!;
    expect(d.sections[0]).toMatchObject({
      label: "Irregulares novos",
      total: 1,
    });
    expect(d.contentKeys).toEqual(["irregular:e1"]);
  });
});

describe("newIrregulars", () => {
  const today = [
    { employeeId: "e1", name: "Ana", reason: "x" },
    { employeeId: "e2", name: "Bruno", reason: "y" },
  ];
  it("só quem não estava irregular na última foto", () => {
    expect(newIrregulars(today, ["e1"]).map((e) => e.name)).toEqual(["Bruno"]);
  });
  it("na primeira foto ninguém é novo (vira a base)", () => {
    expect(newIrregulars(today, null)).toEqual([]);
  });
});

describe("digestSubject", () => {
  it("destaca os críticos", () => {
    expect(digestSubject("Acme", 3, 1)).toBe("3 itens críticos hoje · Acme");
    expect(digestSubject("Acme", 0, 1)).toBe("1 item pede atenção · Acme");
  });
});
