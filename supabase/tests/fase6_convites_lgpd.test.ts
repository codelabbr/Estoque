import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  asUser,
  createTestDb,
  createUser,
  errorOf,
  makeOrg,
  type TestDb,
} from "./harness";

let db: TestDb;
let a: { userId: string; orgId: string };
let admin: string;
let safety: string;

const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

async function invite(user: string, email: string, role = "storekeeper") {
  const token = randomBytes(32).toString("base64url");
  await asUser(db, user, (tx) =>
    tx.query("select create_invite($1, $2, $3, $4)", [
      a.orgId,
      email,
      role,
      sha(token),
    ]),
  );
  return token;
}

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "lgpd-a");
  admin = await addMember(db, a.orgId, "admin", "admin@lgpd-a.dev");
  safety = await addMember(db, a.orgId, "safety", "tst@lgpd-a.dev");
});

describe("convites", () => {
  it("convidado com o mesmo e-mail entra com o papel do convite", async () => {
    const token = await invite(admin, "Nova@Empresa.dev");
    const nova = await createUser(db, "nova@empresa.dev");
    const info = await asUser(
      db,
      nova,
      async (tx) =>
        (
          await tx.query<{ r: { organization_name: string; role: string } }>(
            "select get_invite($1) as r",
            [token],
          )
        ).rows[0].r,
    );
    expect(info).toMatchObject({
      organization_name: "Empresa lgpd-a",
      role: "storekeeper",
    });
    const slug = await asUser(
      db,
      nova,
      async (tx) =>
        (
          await tx.query<{ s: string }>("select accept_invite($1) as s", [
            token,
          ])
        ).rows[0].s,
    );
    expect(slug).toBe("lgpd-a");
    const { rows } = await db.query<{ role: string }>(
      "select role from organization_members where organization_id = $1 and user_id = $2",
      [a.orgId, nova],
    );
    expect(rows[0].role).toBe("storekeeper");
    expect(
      await errorOf(
        asUser(db, nova, (tx) => tx.query("select accept_invite($1)", [token])),
      ),
    ).toMatch(/convite_usado/);
  });

  it("outro e-mail não aceita o convite", async () => {
    const token = await invite(admin, "certo@empresa.dev");
    const intruso = await createUser(db, "intruso@empresa.dev");
    expect(
      await errorOf(
        asUser(db, intruso, (tx) =>
          tx.query("select accept_invite($1)", [token]),
        ),
      ),
    ).toMatch(/convite_outro_email/);
  });

  it("safety não convida; admin não convida owner", async () => {
    expect(await errorOf(invite(safety, "x@empresa.dev"))).toMatch(
      /permissao_negada/,
    );
    expect(await errorOf(invite(admin, "y@empresa.dev", "owner"))).toMatch(
      /permissao_negada/,
    );
  });

  it("reenviar convite revoga o anterior", async () => {
    const old = await invite(admin, "dup@empresa.dev");
    await invite(admin, "dup@empresa.dev");
    const dup = await createUser(db, "dup@empresa.dev");
    expect(
      await errorOf(
        asUser(db, dup, (tx) => tx.query("select get_invite($1)", [old])),
      ),
    ).toMatch(/convite_invalido/);
  });
});

describe("dados de exemplo", () => {
  it("popula a organização vazia usando as regras normais", async () => {
    await asUser(db, a.userId, (tx) =>
      tx.query("select seed_demo_data($1)", [a.orgId]),
    );
    const counts = await db.query<{
      e: number;
      d: number;
      s: number;
      t: number;
    }>(
      `select (select count(*)::int from employees where organization_id = $1) e,
              (select count(*)::int from epi_deliveries where organization_id = $1) d,
              (select count(*)::int from signatures where organization_id = $1) s,
              (select count(*)::int from employee_trainings where organization_id = $1) t`,
      [a.orgId],
    );
    expect(counts.rows[0]).toMatchObject({ e: 8, d: 6, s: 5 });
    const alerts = await asUser(db, a.userId, async (tx) =>
      (
        await tx.query<{ kind: string }>("select distinct kind from v_alerts")
      ).rows.map((r) => r.kind),
    );
    expect(alerts).toEqual(
      expect.arrayContaining([
        "ca_vencido",
        "treinamento_vencido",
        "treinamento_pendente",
      ]),
    );
    expect(
      await errorOf(
        asUser(db, a.userId, (tx) =>
          tx.query("select seed_demo_data($1)", [a.orgId]),
        ),
      ),
    ).toMatch(/organizacao_com_dados/);
  });
});

describe("LGPD", () => {
  let employee: string;
  beforeAll(async () => {
    employee = (
      await db.query<{ id: string }>(
        "select id from employees where organization_id = $1 and cpf = '52998224725'",
        [a.orgId],
      )
    ).rows[0].id;
  });

  it("exporta os dados do funcionário (owner/admin) e audita", async () => {
    const data = await asUser(
      db,
      admin,
      async (tx) =>
        (
          await tx.query<{
            r: { funcionario: { cpf: string }; entregas: unknown[] };
          }>("select export_employee_data($1) as r", [employee])
        ).rows[0].r,
    );
    expect(data.funcionario.cpf).toBe("52998224725");
    expect(data.entregas.length).toBeGreaterThan(0);
    expect(
      await errorOf(
        asUser(db, safety, (tx) =>
          tx.query("select export_employee_data($1)", [employee]),
        ),
      ),
    ).toMatch(/permissao_negada/);
  });

  it("anonimização exige owner e funcionário desligado; mantém a ficha", async () => {
    expect(
      await errorOf(
        asUser(db, a.userId, (tx) =>
          tx.query("select anonymize_employee($1)", [employee]),
        ),
      ),
    ).toMatch(/anonimizar_ativo/);
    await db.query(
      "update employees set terminated_at = current_date where id = $1",
      [employee],
    );
    expect(
      await errorOf(
        asUser(db, admin, (tx) =>
          tx.query("select anonymize_employee($1)", [employee]),
        ),
      ),
    ).toMatch(/permissao_negada/);
    await asUser(db, a.userId, (tx) =>
      tx.query("select anonymize_employee($1)", [employee]),
    );
    const { rows } = await db.query<{
      full_name: string;
      cpf: string;
      phone: string | null;
    }>("select full_name, cpf, phone from employees where id = $1", [employee]);
    expect(rows[0].full_name).toMatch(/^Titular anonimizado /);
    expect(rows[0].cpf).not.toBe("52998224725");
    const snap = await db.query<{ n: number }>(
      "select count(*)::int n from epi_deliveries where employee_id = $1 and employee_cpf_snapshot = '52998224725'",
      [employee],
    );
    expect(snap.rows[0].n).toBeGreaterThan(0);
  });
});
