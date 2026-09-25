import { beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  asAnon,
  asUser,
  createTestDb,
  errorOf,
  makeOrg,
  type TestDb,
} from "./harness";

let db: TestDb;
let a: { userId: string; orgId: string };
let b: { userId: string; orgId: string };
let viewerA: string;
let storekeeperA: string;

const CPF = "52998224725";

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "cad-a");
  b = await makeOrg(db, "cad-b");
  viewerA = await addMember(db, a.orgId, "viewer", "viewer@cad-a.dev");
  storekeeperA = await addMember(db, a.orgId, "storekeeper", "alm@cad-a.dev");
});

describe("create_organization", () => {
  it("semeia os tipos de treinamento sugeridos", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from training_types where organization_id = $1",
      [a.orgId],
    );
    expect(rows[0].n).toBe(10);
  });
});

describe("employees", () => {
  it("owner cadastra funcionário na própria organização", async () => {
    const id = await asUser(db, a.userId, async (tx) => {
      const { rows } = await tx.query<{ id: string; created_by: string }>(
        "insert into employees (organization_id, full_name, cpf) values ($1, 'Ana Souza', $2) returning id, created_by",
        [a.orgId, CPF],
      );
      expect(rows[0].created_by).toBe(a.userId);
      return rows[0].id;
    });
    expect(id).toBeTruthy();
  });

  it("CPF duplicado na mesma organização é bloqueado", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "insert into employees (organization_id, full_name, cpf) values ($1, 'Outra Ana', $2)",
          [a.orgId, CPF],
        ),
      ),
    );
    expect(err).toMatch(/employees_organization_id_cpf_key/);
  });

  it("o mesmo CPF pode existir em outra organização", async () => {
    const err = await errorOf(
      asUser(db, b.userId, (tx) =>
        tx.query(
          "insert into employees (organization_id, full_name, cpf) values ($1, 'Ana na B', $2)",
          [b.orgId, CPF],
        ),
      ),
    );
    expect(err).toBeNull();
  });

  it("CPF com máscara é rejeitado pelo banco", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "insert into employees (organization_id, full_name, cpf) values ($1, 'Mascarado', '529.982.247-25')",
          [a.orgId],
        ),
      ),
    );
    expect(err).toMatch(/check constraint/);
  });

  it("usuário da org A não lê funcionários da org B", async () => {
    const rows = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ organization_id: string }>(
            "select organization_id from employees",
          )
        ).rows,
    );
    expect(rows.every((r) => r.organization_id === a.orgId)).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("usuário da org A não insere na org B", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "insert into employees (organization_id, full_name, cpf) values ($1, 'Intruso', '11144477735')",
          [b.orgId],
        ),
      ),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("viewer e almoxarife não cadastram funcionários", async () => {
    for (const user of [viewerA, storekeeperA]) {
      const err = await errorOf(
        asUser(db, user, (tx) =>
          tx.query(
            "insert into employees (organization_id, full_name, cpf) values ($1, 'Sem permissão', '11144477735')",
            [a.orgId],
          ),
        ),
      );
      expect(err).toMatch(/row-level security/);
    }
  });

  it("ninguém exclui funcionário (só arquivar)", async () => {
    const deleted = await asUser(
      db,
      a.userId,
      async (tx) => (await tx.query("delete from employees returning id")).rows,
    );
    expect(deleted).toHaveLength(0);
  });

  it("não é possível vincular cargo de outra organização", async () => {
    const jobRoleB = await asUser(
      db,
      b.userId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "insert into job_roles (organization_id, name) values ($1, 'Soldador') returning id",
            [b.orgId],
          )
        ).rows[0].id,
    );
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "insert into employees (organization_id, full_name, cpf, job_role_id) values ($1, 'Cruzado', '11144477735', $2)",
          [a.orgId, jobRoleB],
        ),
      ),
    );
    expect(err).toMatch(/foreign key/);
  });

  it("anon não lê funcionários", async () => {
    const rows = await asAnon(
      db,
      async (tx) => (await tx.query("select 1 from employees")).rows,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("epis e variações", () => {
  it("variação precisa ser da mesma organização do EPI", async () => {
    const epiA = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "insert into epis (organization_id, name, category) values ($1, 'Luva nitrílica', 'membros_superiores') returning id",
            [a.orgId],
          )
        ).rows[0].id,
    );
    const err = await errorOf(
      asUser(db, b.userId, (tx) =>
        tx.query(
          "insert into epi_variants (organization_id, epi_id, size_label) values ($1, $2, 'M')",
          [b.orgId, epiA],
        ),
      ),
    );
    expect(err).not.toBeNull();
  });

  it("tamanho repetido no mesmo EPI é bloqueado", async () => {
    const err = await errorOf(
      asUser(db, a.userId, async (tx) => {
        const epi = (
          await tx.query<{ id: string }>(
            "insert into epis (organization_id, name, category) values ($1, 'Botina', 'membros_inferiores') returning id",
            [a.orgId],
          )
        ).rows[0].id;
        await tx.query(
          "insert into epi_variants (organization_id, epi_id, size_label) values ($1, $2, '40'), ($1, $2, '40')",
          [a.orgId, epi],
        );
      }),
    );
    expect(err).toMatch(/epi_variants_epi_id_size_label_key/);
  });
});

describe("matriz de exigências", () => {
  it("safety monta a matriz e pode remover vínculo", async () => {
    const safety = await addMember(db, a.orgId, "safety", "tst@cad-a.dev");
    await asUser(db, safety, async (tx) => {
      const role = (
        await tx.query<{ id: string }>(
          "insert into job_roles (organization_id, name) values ($1, 'Eletricista') returning id",
          [a.orgId],
        )
      ).rows[0].id;
      const training = (
        await tx.query<{ id: string }>(
          "select id from training_types where organization_id = $1 and name = 'NR-10 Básico'",
          [a.orgId],
        )
      ).rows[0].id;
      await tx.query(
        "insert into job_role_training_requirements (organization_id, job_role_id, training_type_id) values ($1, $2, $3)",
        [a.orgId, role, training],
      );
      const removed = await tx.query(
        "delete from job_role_training_requirements where job_role_id = $1 returning 1",
        [role],
      );
      expect(removed.rows).toHaveLength(1);
    });
  });
});

describe("auditoria", () => {
  it("cadastros geram linhas no audit_log", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from audit_log where table_name = 'employees' and organization_id = $1",
      [a.orgId],
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });
});

describe("create_epi", () => {
  it("cria o EPI e os tamanhos numa transação (sem duplicar)", async () => {
    const id = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            `select create_epi($1, '{"name":"Luva de raspa","category":"membros_superiores","ca_number":"12345","lifespan_days":"90"}'::jsonb, array['P','M',' M ','G','']) as id`,
            [a.orgId],
          )
        ).rows[0].id,
    );
    const { rows } = await db.query<{ size_label: string }>(
      "select size_label from epi_variants where epi_id = $1 order by size_label",
      [id],
    );
    expect(rows.map((r) => r.size_label)).toEqual(["G", "M", "P"]);
  });

  it("sem tamanhos informados cria 'Único'", async () => {
    const id = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            `select create_epi($1, '{"name":"Protetor auricular","category":"auditiva"}'::jsonb, array[]::text[]) as id`,
            [a.orgId],
          )
        ).rows[0].id,
    );
    const { rows } = await db.query<{ size_label: string }>(
      "select size_label from epi_variants where epi_id = $1",
      [id],
    );
    expect(rows.map((r) => r.size_label)).toEqual(["Único"]);
  });

  it("almoxarife não cria EPI (RLS dentro da função)", async () => {
    const err = await errorOf(
      asUser(db, storekeeperA, (tx) =>
        tx.query(
          `select create_epi($1, '{"name":"X","category":"outro"}'::jsonb)`,
          [a.orgId],
        ),
      ),
    );
    expect(err).toMatch(/row-level security/);
  });
});

describe("import_employees", () => {
  it("cria cargos/setores por nome, ignora CPF existente e é atômico", async () => {
    const result = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{
            r: {
              inserted: number;
              skipped: number;
              skipped_rows: { cpf: string; reason: string }[];
              created_job_roles: string[];
            };
          }>("select import_employees($1, $2::jsonb) as r", [
            a.orgId,
            JSON.stringify([
              {
                full_name: "Bruno Lima",
                cpf: "11144477735",
                job_role: "eletricista",
                sector: "Manutenção",
              },
              {
                full_name: "Carla Dias",
                cpf: "39053344705",
                job_role: "Pintor",
                sector: "manutenção",
                hired_at: "2024-03-05",
              },
              { full_name: "Ana Duplicada", cpf: CPF },
            ]),
          ])
        ).rows[0].r,
    );
    expect(result).toMatchObject({ inserted: 2, skipped: 1 });
    expect(result.skipped_rows).toEqual([
      { cpf: CPF, name: "Ana Duplicada", reason: "ja_cadastrado" },
    ]);
    expect(result.created_job_roles).toEqual(["Pintor"]);

    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from sectors where organization_id = $1 and lower(name) = 'manutenção'",
      [a.orgId],
    );
    expect(rows[0].n).toBe(1);
    // "eletricista" reaproveita o cargo "Eletricista" criado antes
    const roles = await db.query<{ n: number }>(
      "select count(*)::int as n from job_roles where organization_id = $1 and lower(name) = 'eletricista'",
      [a.orgId],
    );
    expect(roles.rows[0].n).toBe(1);
  });

  it("viewer não importa", async () => {
    const err = await errorOf(
      asUser(db, viewerA, (tx) =>
        tx.query("select import_employees($1, $2::jsonb)", [
          a.orgId,
          JSON.stringify([{ full_name: "X Y", cpf: "86288366757" }]),
        ]),
      ),
    );
    expect(err).toMatch(/row-level security/);
  });
});
