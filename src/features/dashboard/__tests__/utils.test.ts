import { describe, expect, it } from "vitest";
import { describeActivity } from "@/features/dashboard/utils";

const ctx = { currentUserId: "u1", organizationName: "Aço Peças Oliveira" };
const base = { id: 1, createdAt: "2026-09-23T12:00:00Z" };

describe("describeActivity", () => {
  it("descreve a criação da organização pelo usuário atual", () => {
    const entry = describeActivity(
      {
        ...base,
        action: "insert",
        tableName: "organizations",
        actorId: "u1",
        newData: null,
      },
      ctx,
    );
    expect(entry.actor).toBe("me");
    expect(entry.text).toBe("criou a organização Aço Peças Oliveira");
  });

  it("descreve quem entrou na equipe com o papel em pt-BR", () => {
    const entry = describeActivity(
      {
        ...base,
        action: "insert",
        tableName: "organization_members",
        actorId: "u1",
        newData: { user_id: "u1", role: "owner" },
      },
      ctx,
    );
    expect(entry.text).toBe("entrou na equipe como Proprietário");
  });

  it("diferencia membro adicionado por outra pessoa", () => {
    const entry = describeActivity(
      {
        ...base,
        action: "insert",
        tableName: "organization_members",
        actorId: "u2",
        newData: { user_id: "u3", role: "storekeeper" },
      },
      ctx,
    );
    expect(entry.actor).toBe("other");
    expect(entry.text).toBe("adicionou um membro como Almoxarife");
  });

  it("marca ações sem autor como do sistema", () => {
    const entry = describeActivity(
      {
        ...base,
        action: "update",
        tableName: "organizations",
        actorId: null,
        newData: null,
      },
      ctx,
    );
    expect(entry.actor).toBe("system");
  });
});

describe("describeActivity (operações)", () => {
  it("descreve RPCs de entrega e estoque", () => {
    const e = describeActivity(
      {
        ...base,
        action: "deliver_epis",
        tableName: "epi_deliveries",
        actorId: "u1",
        newData: null,
      },
      ctx,
    );
    expect(e.text).toBe("registrou uma entrega de EPI");
  });

  it("descreve cadastro de funcionário com o nome", () => {
    const e = describeActivity(
      {
        ...base,
        action: "insert",
        tableName: "employees",
        actorId: "u1",
        newData: { full_name: "Ana Souza" },
      },
      ctx,
    );
    expect(e.text).toBe("cadastrou um funcionário (Ana Souza)");
  });

  it("descreve alterações na matriz e liberação de CA vencido", () => {
    const matrix = describeActivity(
      {
        ...base,
        action: "update",
        tableName: "job_role_epi_requirements",
        actorId: "u1",
        newData: { replacement_days: 15 },
      },
      ctx,
    );
    expect(matrix.text).toBe("alterou um EPI na matriz de um cargo");
    const ca = describeActivity(
      {
        ...base,
        action: "deliver_epis:ca_vencido",
        tableName: "epi_delivery_items",
        actorId: "u1",
        newData: null,
      },
      ctx,
    );
    expect(ca.text).toBe("liberou a entrega de um EPI com CA vencido");
  });
});
