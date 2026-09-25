import { describe, expect, it } from "vitest";
import {
  rankBySector,
  summarize,
  todayActions,
  type ComplianceRow,
  type Pendencia,
} from "../compliance";

const p = (
  tipo: Pendencia["tipo"],
  item: string,
  item_id = "x",
  severidade: Pendencia["severidade"] = "irregular",
): Pendencia => ({ tipo, item, item_id, severidade, data_referencia: null });

const rows: ComplianceRow[] = [
  {
    employeeId: "e1",
    employeeName: "Ana",
    sectorName: "Produção",
    status: "irregular",
    pendencias: [
      p("troca_vencida", "Luva"),
      p("ca_vencido_em_uso", "Máscara (CA 1)"),
      p("treinamento_nunca_realizado", "NR-12", "t12"),
    ],
  },
  {
    employeeId: "e2",
    employeeName: "Bruno",
    sectorName: "Produção",
    status: "em_dia",
    pendencias: [p("troca_vencendo", "Luva", "x", "aviso")],
  },
  {
    employeeId: "e3",
    employeeName: "Elaine",
    sectorName: null,
    status: "irregular",
    pendencias: [p("entrega_sem_assinatura", "Entrega de 25/09/2026", "d1")],
  },
  {
    employeeId: "e4",
    employeeName: "Henrique",
    sectorName: "Manutenção",
    status: "em_dia",
    pendencias: [p("treinamento_vencendo", "NR-06", "t6", "aviso")],
  },
];

describe("summarize", () => {
  it("em dia inclui quem só tem avisos", () => {
    expect(summarize(rows)).toEqual({
      total: 4,
      emDia: 2,
      irregular: 2,
      pct: 50,
      trocasVencendo: 1,
      treinamentosVencendo: 1,
    });
  });

  it("sem funcionários o percentual é null", () => {
    expect(summarize([]).pct).toBeNull();
  });
});

describe("rankBySector", () => {
  it("ordena do pior para o melhor e agrupa quem não tem setor", () => {
    expect(rankBySector(rows)).toEqual([
      { sector: "Sem setor", total: 1, emDia: 0, pct: 0 },
      { sector: "Produção", total: 2, emDia: 1, pct: 50 },
      { sector: "Manutenção", total: 1, emDia: 1, pct: 100 },
    ]);
  });
});

describe("todayActions", () => {
  const actions = todayActions(rows, "acme");

  it("agrupa pendências de EPI do funcionário numa ação Entregar", () => {
    const a = actions.find((x) => x.key === "entregar:e1")!;
    expect(a.action).toEqual({
      label: "Entregar",
      href: "/acme/entregas/nova?funcionario=e1",
    });
    expect(a.detail).toBe(
      "Luva (troca vencida), Máscara (CA 1) (CA vencido em uso)",
    );
  });

  it("treinamento abre o registro já com tipo e funcionário", () => {
    expect(actions.find((x) => x.key === "treinar:e1:t12")?.action.href).toBe(
      "/acme/treinamentos/registrar?tipo=t12&funcionario=e1",
    );
  });

  it("entrega sem assinatura leva à entrega", () => {
    expect(actions.find((x) => x.key === "assinar:d1")?.action).toEqual({
      label: "Coletar assinatura",
      href: "/acme/entregas/d1",
    });
  });

  it("avisos não geram ação", () => {
    expect(actions.some((x) => x.title === "Bruno")).toBe(false);
    expect(actions.some((x) => x.title === "Henrique")).toBe(false);
  });
});
