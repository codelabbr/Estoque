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
