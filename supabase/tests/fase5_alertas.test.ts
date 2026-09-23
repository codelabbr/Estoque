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

let db: TestDb;
let a: { userId: string; orgId: string };
let b: { userId: string; orgId: string };
let viewer: string;

type Alert = {
  alert_key: string;
  kind: string;
  severity: string;
  organization_id: string;
};

async function alerts(user = a.userId) {
  return asUser(
    db,
    user,
    async (tx) =>
      (
        await tx.query<Alert>(
          "select alert_key, kind, severity, organization_id from v_alerts",
        )
      ).rows,
  );
}

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "ale-a");
  b = await makeOrg(db, "ale-b");
  viewer = await addMember(db, a.orgId, "viewer", "viewer@ale-a.dev");
  await asUser(db, a.userId, async (tx) => {
    const role = (
      await tx.query<{ id: string }>(
        "insert into job_roles (organization_id, name) values ($1, 'Soldador') returning id",
        [a.orgId],
      )
    ).rows[0].id;
    const nr = (
      await tx.query<{ id: string }>(
        "select id from training_types where organization_id = $1 and name like 'NR-35%'",
        [a.orgId],
      )
    ).rows[0].id;
    await tx.query(
      "insert into job_role_training_requirements (organization_id, job_role_id, training_type_id) values ($1, $2, $3)",
      [a.orgId, role, nr],
    );
    await tx.query(
      "insert into employees (organization_id, full_name, cpf, job_role_id) values ($1, 'Ana Souza', '52998224725', $2)",
      [a.orgId, role],
    );
    const epi = (
      await tx.query<{ id: string }>(
        `select create_epi($1, '{"name":"Luva","category":"membros_superiores","ca_number":"123","ca_expires_at":"2000-01-01"}'::jsonb) as id`,
        [a.orgId],
      )
    ).rows[0].id;
    await tx.query("update epi_variants set min_stock = 5 where epi_id = $1", [
      epi,
    ]);
  });
  await asUser(db, b.userId, (tx) =>
    tx.query(
      `select create_epi($1, '{"name":"Bota B","category":"membros_inferiores","ca_number":"9","ca_expires_at":"2000-01-01"}'::jsonb)`,
      [b.orgId],
    ),
  );
});

describe("v_alerts", () => {
  it("une treinamento pendente, CA vencido e estoque mínimo", async () => {
    const kinds = (await alerts()).map((x) => x.kind).sort();
    expect(kinds).toEqual([
      "ca_vencido",
      "estoque_minimo",
      "treinamento_pendente",
    ]);
    const stock = (await alerts()).find((x) => x.kind === "estoque_minimo")!;
    expect(stock.severity).toBe("critico"); // saldo zero
  });

  it("não mostra alertas de outra organização", async () => {
    expect((await alerts()).every((x) => x.organization_id === a.orgId)).toBe(
      true,
    );
  });

  it("adiar esconde até a data; resolver esconde", async () => {
    const list = await alerts();
    const ca = list.find((x) => x.kind === "ca_vencido")!;
    const tr = list.find((x) => x.kind === "treinamento_pendente")!;
    await asUser(db, a.userId, async (tx) => {
      await tx.query(
        "insert into alert_states (organization_id, alert_key, status, snoozed_until) values ($1, $2, 'adiado', current_date + 7)",
        [a.orgId, ca.alert_key],
      );
      await tx.query(
        "insert into alert_states (organization_id, alert_key, status) values ($1, $2, 'resolvido')",
        [a.orgId, tr.alert_key],
      );
    });
    expect((await alerts()).map((x) => x.kind)).toEqual(["estoque_minimo"]);
    await db.query(
      "update alert_states set snoozed_until = current_date - 1 where alert_key = $1",
      [ca.alert_key],
    );
    expect((await alerts()).map((x) => x.kind)).toContain("ca_vencido");
  });

  it("viewer vê alertas mas não altera estado", async () => {
    expect((await alerts(viewer)).length).toBeGreaterThan(0);
    const err = await errorOf(
      asUser(db, viewer, (tx) =>
        tx.query(
          "insert into alert_states (organization_id, alert_key, status) values ($1, 'x', 'resolvido')",
          [a.orgId],
        ),
      ),
    );
    expect(err).toMatch(/row-level security/);
  });
});

describe("resumo diário", () => {
  it("digest_recipients só para service role", async () => {
    expect(
      await errorOf(
        asUser(db, a.userId, (tx) =>
          tx.query("select * from digest_recipients($1)", [a.orgId]),
        ),
      ),
    ).toMatch(/permission denied/);
    const rows = await asService(
      db,
      async (tx) =>
        (
          await tx.query<{ email: string }>(
            "select email from digest_recipients($1)",
            [a.orgId],
          )
        ).rows,
    );
    expect(rows.map((r) => r.email)).toEqual(["ale-a@teste.almoxsst.dev"]);
  });

  it("usuário desativa o próprio resumo", async () => {
    await asUser(db, a.userId, (tx) =>
      tx.query("select set_my_daily_digest($1, false)", [a.orgId]),
    );
    const rows = await asService(
      db,
      async (tx) =>
        (await tx.query("select * from digest_recipients($1)", [a.orgId])).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("notification_log impede envio duplicado no mesmo dia", async () => {
    await db.query(
      "insert into notification_log (organization_id, user_id, kind, payload_hash) values ($1, $2, 'daily_digest', 'h')",
      [a.orgId, a.userId],
    );
    expect(
      await errorOf(
        db.query(
          "insert into notification_log (organization_id, user_id, kind, payload_hash) values ($1, $2, 'daily_digest', 'h')",
          [a.orgId, a.userId],
        ),
      ),
    ).toMatch(/duplicate key/);
  });
});
