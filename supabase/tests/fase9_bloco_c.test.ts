import { beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  asService,
  asUser,
  createTestDb,
  errorOf,
  makeOrg,
  type TestDb,
} from "./harness";

type ImportResult = {
  inserted: number;
  skipped: number;
  skipped_rows: { cpf: string; name: string; reason: string }[];
  created_job_roles: string[];
};

let db: TestDb;
let a: { userId: string; orgId: string };
let b: { userId: string; orgId: string };
let safety: string;
let storekeeper: string;
let viewer: string;

async function q<T>(sql: string, params: unknown[] = [], user = a.userId) {
  return asUser(db, user, async (tx) => (await tx.query<T>(sql, params)).rows);
}

async function importEmployees(rows: object[], createRoles = true) {
  return (
    await q<{ r: ImportResult }>(
      "select import_employees($1, $2::jsonb, $3) as r",
      [a.orgId, JSON.stringify(rows), createRoles],
    )
  )[0].r;
}

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "blc-a");
  b = await makeOrg(db, "blc-b");
  safety = await addMember(db, a.orgId, "safety", "sst@blc-a.dev");
  storekeeper = await addMember(db, a.orgId, "storekeeper", "alm@blc-a.dev");
  viewer = await addMember(db, a.orgId, "viewer", "ver@blc-a.dev");
  await q(
    "insert into job_roles (organization_id, name) values ($1, 'Soldador')",
    [a.orgId],
  );
});

describe("import_employees", () => {
  it("sem autorização para criar cargos, pula as linhas com cargo inexistente", async () => {
    const r = await importEmployees(
      [
        { full_name: "Ana Souza", cpf: "52998224725", job_role: "soldador" },
        { full_name: "Bruno Lima", cpf: "11144477735", job_role: "Pintor" },
      ],
      false,
    );
    expect(r.inserted).toBe(1);
    expect(r.skipped_rows).toEqual([
      { cpf: "11144477735", name: "Bruno Lima", reason: "cargo_inexistente" },
    ]);
    expect(r.created_job_roles).toEqual([]);
    const roles = await q<{ n: number }>(
      "select count(*)::int as n from job_roles where organization_id = $1 and lower(name) = 'pintor'",
      [a.orgId],
    );
    expect(roles[0].n).toBe(0);
  });

  it("com autorização, cria o cargo e informa quais foram criados", async () => {
    const r = await importEmployees([
      { full_name: "Bruno Lima", cpf: "11144477735", job_role: "Pintor" },
    ]);
    expect(r.inserted).toBe(1);
    expect(r.created_job_roles).toEqual(["Pintor"]);
  });

  it("matrícula já cadastrada pula a linha em vez de abortar a importação", async () => {
    await importEmployees([
      { full_name: "Carla Dias", cpf: "39053344705", registration: "0007" },
    ]);
    const r = await importEmployees([
      { full_name: "Outra Pessoa", cpf: "86288366757", registration: "0007" },
      { full_name: "Diego Rocha", cpf: "71428793860", registration: "0008" },
    ]);
    expect(r.inserted).toBe(1);
    expect(r.skipped_rows).toEqual([
      { cpf: "86288366757", name: "Outra Pessoa", reason: "ja_cadastrado" },
    ]);
  });

  it("viewer não importa", async () => {
    expect(
      await errorOf(
        q(
          "select import_employees($1, $2::jsonb)",
          [
            a.orgId,
            JSON.stringify([
              { full_name: "Sem Permissão", cpf: "04542856046" },
            ]),
          ],
          viewer,
        ),
      ),
    ).toMatch(/row-level security/);
  });
});

describe("import_job_roles", () => {
  it("cadastra cargos novos e pula os existentes (sem diferenciar maiúsculas)", async () => {
    const r = (
      await q<{ r: { inserted: number; skipped: string[] } }>(
        "select import_job_roles($1, $2::jsonb) as r",
        [
          a.orgId,
          JSON.stringify([
            { name: "Eletricista", cbo: "7156-10", description: "NR-10" },
            { name: "SOLDADOR" },
          ]),
        ],
      )
    )[0].r;
    expect(r).toEqual({ inserted: 1, skipped: ["SOLDADOR"] });
    const row = await q<{ cbo: string; description: string }>(
      "select cbo, description from job_roles where organization_id = $1 and name = 'Eletricista'",
      [a.orgId],
    );
    expect(row[0]).toEqual({ cbo: "7156-10", description: "NR-10" });
  });

  it("almoxarife não cadastra cargos", async () => {
    expect(
      await errorOf(
        q(
          "select import_job_roles($1, $2::jsonb)",
          [a.orgId, JSON.stringify([{ name: "Motorista" }])],
          storekeeper,
        ),
      ),
    ).toMatch(/row-level security/);
  });
});

describe("auditoria da matriz", () => {
  it("inserir, alterar e remover exigências fica no audit_log, que é imutável", async () => {
    const epi = (
      await q<{ id: string }>(
        `select create_epi($1, '{"name":"Luva","category":"membros_superiores"}'::jsonb) as id`,
        [a.orgId],
      )
    )[0].id;
    const role = (
      await q<{ id: string }>(
        "select id from job_roles where organization_id = $1 and name = 'Soldador'",
        [a.orgId],
      )
    )[0].id;
    await q(
      "insert into job_role_epi_requirements (organization_id, job_role_id, epi_id) values ($1, $2, $3)",
      [a.orgId, role, epi],
    );
    await q(
      "update job_role_epi_requirements set replacement_days = 10 where job_role_id = $1",
      [role],
    );
    await q("delete from job_role_epi_requirements where job_role_id = $1", [
      role,
    ]);
    const audit = await q<{ action: string; before: number; after: number }>(
      `select action, (old_data ->> 'replacement_days')::int as before, (new_data ->> 'replacement_days')::int as after
         from audit_log where table_name = 'job_role_epi_requirements' and organization_id = $1
        order by id`,
      [a.orgId],
    );
    expect(audit.map((x) => x.action)).toEqual(["insert", "update", "delete"]);
    expect(audit[1]).toMatchObject({ before: null, after: 10 });
    expect(
      await errorOf(
        db.query(
          "delete from audit_log where table_name = 'job_role_epi_requirements'",
        ),
      ),
    ).toMatch(/registro_imutavel/);
  });
});

describe("alert_settings", () => {
  it("proprietário configura; segurança do trabalho só lê; outra organização não vê", async () => {
    await q(
      "insert into alert_settings (organization_id, notify_stock) values ($1, false)",
      [a.orgId],
    );
    const mine = await q<{ notify_stock: boolean }>(
      "select notify_stock from alert_settings where organization_id = $1",
      [a.orgId],
      safety,
    );
    expect(mine[0].notify_stock).toBe(false);
    expect(
      await q(
        "update alert_settings set notify_stock = true where organization_id = $1 returning 1",
        [a.orgId],
        safety,
      ),
    ).toEqual([]);
    expect(
      await q(
        "select 1 from alert_settings where organization_id = $1",
        [a.orgId],
        b.userId,
      ),
    ).toEqual([]);
  });
});

describe("compliance_snapshots", () => {
  it("só o job grava; proprietário lê", async () => {
    expect(
      await errorOf(
        q(
          "insert into compliance_snapshots (organization_id, taken_on) values ($1, current_date)",
          [a.orgId],
        ),
      ),
    ).toMatch(/row-level security/);
    await asService(db, (tx) =>
      tx.query(
        "insert into compliance_snapshots (organization_id, taken_on, irregular_employee_ids) values ($1, current_date, '{}')",
        [a.orgId],
      ),
    );
    expect(
      await q<{ n: number }>(
        "select count(*)::int as n from compliance_snapshots where organization_id = $1",
        [a.orgId],
      ),
    ).toEqual([{ n: 1 }]);
    expect(
      await q(
        "select 1 from compliance_snapshots where organization_id = $1",
        [a.orgId],
        storekeeper,
      ),
    ).toEqual([]);
  });
});

describe("destinatários do resumo diário", () => {
  const recipients = () =>
    asService(db, async (tx) =>
      (
        await tx.query<{ user_id: string }>(
          "select user_id from digest_recipients($1)",
          [a.orgId],
        )
      ).rows.map((r) => r.user_id),
    );

  it("almoxarife e somente leitura entram sem o resumo; admin pode ligar", async () => {
    let list = await recipients();
    expect(list).toContain(a.userId);
    expect(list).toContain(safety);
    expect(list).not.toContain(storekeeper);
    expect(list).not.toContain(viewer);

    await q(
      "update organization_members set daily_digest = true where organization_id = $1 and user_id = $2",
      [a.orgId, storekeeper],
    );
    list = await recipients();
    expect(list).toContain(storekeeper);
  });

  it("o job consegue calcular a conformidade", async () => {
    const rows = await asService(
      db,
      async (tx) =>
        (
          await tx.query<{ status: string }>(
            "select status from fn_conformidade_funcionarios($1)",
            [a.orgId],
          )
        ).rows,
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
