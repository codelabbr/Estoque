import { beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  asUser,
  createTestDb,
  errorOf,
  makeOrg,
  type TestDb,
} from "./harness";

let db: TestDb;
let a: { userId: string; orgId: string };
let storekeeper: string;
let jobRole: string;
let nr35: string; // 24 meses
let nr06: string; // sem vencimento
let cipa: string; // 12 meses
let ana: string;
let bruno: string;

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
const shift = (days: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function statusOf(employee: string, type: string) {
  const rows = await asUser(
    db,
    a.userId,
    async (tx) =>
      (
        await tx.query<{ status: string }>(
          "select status from v_employee_training_status where employee_id = $1 and training_type_id = $2",
          [employee, type],
        )
      ).rows,
  );
  return rows[0]?.status ?? null;
}

async function compliance(employee: string) {
  const rows = await asUser(
    db,
    a.userId,
    async (tx) =>
      (
        await tx.query<{ status: string; issues: { kind: string }[] }>(
          "select status, issues from v_employee_compliance where employee_id = $1",
          [employee],
        )
      ).rows,
  );
  return rows[0] ?? null;
}

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "tre-a");
  storekeeper = await addMember(db, a.orgId, "storekeeper", "alm@tre-a.dev");
  const types = await db.query<{ id: string; name: string }>(
    "select id, name from training_types where organization_id = $1",
    [a.orgId],
  );
  const byName = (n: string) => types.rows.find((t) => t.name === n)!.id;
  nr35 = byName("NR-35 Trabalho em altura");
  nr06 = byName("NR-06 Uso de EPI");
  cipa = byName("NR-05 CIPA");
  await asUser(db, a.userId, async (tx) => {
    jobRole = (
      await tx.query<{ id: string }>(
        "insert into job_roles (organization_id, name) values ($1, 'Montador') returning id",
        [a.orgId],
      )
    ).rows[0].id;
    await tx.query(
      "insert into job_role_training_requirements (organization_id, job_role_id, training_type_id) values ($1, $2, $3), ($1, $2, $4)",
      [a.orgId, jobRole, nr35, nr06],
    );
    ana = (
      await tx.query<{ id: string }>(
        "insert into employees (organization_id, full_name, cpf, job_role_id) values ($1, 'Ana Souza', '52998224725', $2) returning id",
        [a.orgId, jobRole],
      )
    ).rows[0].id;
    bruno = (
      await tx.query<{ id: string }>(
        "insert into employees (organization_id, full_name, cpf, job_role_id) values ($1, 'Bruno Lima', '11144477735', $2) returning id",
        [a.orgId, jobRole],
      )
    ).rows[0].id;
  });
});

describe("validade", () => {
  it("calcula conclusão + meses, ajustando fim de mês (31/01 + 12 meses)", async () => {
    const row = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ expires_at: string }>(
            "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at) values ($1, $2, $3, '2024-01-31') returning expires_at::text",
            [a.orgId, bruno, cipa],
          )
        ).rows[0],
    );
    expect(row.expires_at).toBe("2025-01-31");
    await db.query(
      "update training_types set validity_months = 1 where id = $1",
      [cipa],
    );
    const r2 = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ expires_at: string }>(
            "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at) values ($1, $2, $3, '2025-01-31') returning expires_at::text",
            [a.orgId, bruno, cipa],
          )
        ).rows[0],
    );
    expect(r2.expires_at).toBe("2025-02-28");
  });

  it("validade manual é respeitada", async () => {
    const row = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ expires_at: string }>(
            "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, expires_at, expires_manually) values ($1, $2, $3, '2025-06-01', '2025-12-01', true) returning expires_at::text",
            [a.orgId, bruno, nr06],
          )
        ).rows[0],
    );
    expect(row.expires_at).toBe("2025-12-01");
  });

  it("conclusão no futuro é rejeitada", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at) values ($1, $2, $3, $4)",
          [a.orgId, ana, nr35, shift(3)],
        ),
      ),
    );
    expect(err).toMatch(/data_futura/);
  });
});

describe("status", () => {
  it("exigido pelo cargo sem registro é pendente", async () => {
    expect(await statusOf(ana, nr35)).toBe("pendente");
  });

  it("vencido, a vencer e válido", async () => {
    // NR-35: 24 meses. Conclusão há 25 meses → vencido.
    await asUser(db, a.userId, (tx) =>
      tx.query(
        "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at) values ($1, $2, $3, $4)",
        [a.orgId, ana, nr35, shift(-760)],
      ),
    );
    expect(await statusOf(ana, nr35)).toBe("vencido");
    // Reciclagem: novo registro que vence em ~10 dias → a_vencer (alerta padrão 30 dias)
    await asUser(db, a.userId, (tx) =>
      tx.query(
        "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, expires_at, expires_manually) values ($1, $2, $3, $4, $5, true)",
        [a.orgId, ana, nr35, shift(-1), shift(10)],
      ),
    );
    expect(await statusOf(ana, nr35)).toBe("a_vencer");
    // Histórico preservado
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int n from employee_trainings where employee_id = $1 and training_type_id = $2",
      [ana, nr35],
    );
    expect(rows[0].n).toBe(2);
  });

  it("sem vencimento fixo fica válido", async () => {
    await asUser(db, a.userId, (tx) =>
      tx.query(
        "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at) values ($1, $2, $3, $4)",
        [a.orgId, ana, nr06, shift(-400)],
      ),
    );
    expect(await statusOf(ana, nr06)).toBe("valido");
  });
});

describe("conformidade", () => {
  it("atenção quando algo está a vencer; irregular quando pendente", async () => {
    expect((await compliance(ana))!.status).toBe("atencao");
    const b = await compliance(bruno);
    expect(b!.status).toBe("irregular");
    expect(b!.issues.map((i) => i.kind)).toContain(
      "treinamento_nunca_realizado",
    );
  });

  it("EPI obrigatório sem entrega deixa irregular", async () => {
    await asUser(db, a.userId, async (tx) => {
      const epi = (
        await tx.query<{ id: string }>(
          `select create_epi($1, '{"name":"Cinto paraquedista","category":"quedas"}'::jsonb) as id`,
          [a.orgId],
        )
      ).rows[0].id;
      await tx.query(
        "insert into job_role_epi_requirements (organization_id, job_role_id, epi_id) values ($1, $2, $3)",
        [a.orgId, jobRole, epi],
      );
    });
    const c = await compliance(ana);
    expect(c!.status).toBe("irregular");
    expect(c!.issues.map((i) => i.kind)).toContain(
      "epi_obrigatorio_nunca_entregue",
    );
  });

  it("funcionário desligado sai da conformidade", async () => {
    await asUser(db, a.userId, (tx) =>
      tx.query("update employees set terminated_at = $2 where id = $1", [
        bruno,
        today(),
      ]),
    );
    expect(await compliance(bruno)).toBeNull();
  });
});

describe("turma e permissões", () => {
  it("registra turma para vários funcionários com o mesmo batch", async () => {
    const carla = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "insert into employees (organization_id, full_name, cpf) values ($1, 'Carla Dias', '39053344705') returning id",
            [a.orgId],
          )
        ).rows[0].id,
    );
    const batch = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ b: string }>(
            "select register_training_batch($1, $2, $3, $4::uuid[], 'SENAI', 'João', 8) as b",
            [a.orgId, cipa, shift(-1), [ana, carla]],
          )
        ).rows[0].b,
    );
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int n from employee_trainings where batch_id = $1",
      [batch],
    );
    expect(rows[0].n).toBe(2);
  });

  it("turma com funcionário desligado falha inteira", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select register_training_batch($1, $2, $3, $4::uuid[])", [
          a.orgId,
          cipa,
          shift(-1),
          [ana, bruno],
        ]),
      ),
    );
    expect(err).toMatch(/funcionario_invalido/);
  });

  it("almoxarife não registra treinamento", async () => {
    const err = await errorOf(
      asUser(db, storekeeper, (tx) =>
        tx.query(
          "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at) values ($1, $2, $3, $4)",
          [a.orgId, ana, cipa, shift(-1)],
        ),
      ),
    );
    expect(err).toMatch(/row-level security/);
  });
});
