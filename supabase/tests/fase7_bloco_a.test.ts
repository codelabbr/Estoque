import { randomBytes } from "node:crypto";
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
let location: string;
let jobRole: string;
let employee: string;
let gloveEpi: string;
let glove: string; // CA válido, vida útil 30 dias
let boot: string; // CA vencido

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  randomBytes(200),
]);
const REASON = "Lote novo em trânsito, uso emergencial";

async function deliver(items: object[], user = a.userId) {
  return asUser(
    db,
    user,
    async (tx) =>
      (
        await tx.query<{ id: string }>(
          "select deliver_epis($1, $2, $3, $4::jsonb) as id",
          [a.orgId, employee, location, JSON.stringify(items)],
        )
      ).rows[0].id,
  );
}

async function item(deliveryId: string) {
  return (
    await db.query<{
      next_replacement_at: string | Date | null;
      ca_expires_at_snapshot: string | Date | null;
      ca_expired_override: boolean;
      ca_override_reason: string | null;
      reason: string;
    }>(
      `select next_replacement_at::text, ca_expires_at_snapshot::text, ca_expired_override,
              ca_override_reason, reason::text
         from epi_delivery_items where delivery_id = $1`,
      [deliveryId],
    )
  ).rows[0];
}

const plusDays = async (n: number) =>
  (
    await db.query<{ d: string }>(
      "select (sao_paulo_today() + $1::int)::text as d",
      [n],
    )
  ).rows[0].d;

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "bloco-a");
  storekeeper = await addMember(db, a.orgId, "storekeeper", "alm@bloco-a.dev");
  location = (
    await db.query<{ id: string }>(
      "select id from stock_locations where organization_id = $1",
      [a.orgId],
    )
  ).rows[0].id;

  await asUser(db, a.userId, async (tx) => {
    jobRole = (
      await tx.query<{ id: string }>(
        "insert into job_roles (organization_id, name) values ($1, 'Soldador') returning id",
        [a.orgId],
      )
    ).rows[0].id;
    employee = (
      await tx.query<{ id: string }>(
        "insert into employees (organization_id, full_name, cpf, job_role_id) values ($1, 'Ana Maria Souza', '52998224725', $2) returning id",
        [a.orgId, jobRole],
      )
    ).rows[0].id;
    const mk = async (json: object) =>
      (
        await tx.query<{ id: string }>(
          "select create_epi($1, $2::jsonb) as id",
          [a.orgId, JSON.stringify(json)],
        )
      ).rows[0].id;
    gloveEpi = await mk({
      name: "Luva",
      category: "membros_superiores",
      ca_number: "11111",
      ca_expires_at: "2099-12-31",
      lifespan_days: "30",
    });
    const bootEpi = await mk({
      name: "Botina",
      category: "membros_inferiores",
      ca_number: "22222",
      ca_expires_at: "2000-01-01",
    });
    glove = (
      await tx.query<{ id: string }>(
        "select id from epi_variants where epi_id = $1",
        [gloveEpi],
      )
    ).rows[0].id;
    boot = (
      await tx.query<{ id: string }>(
        "select id from epi_variants where epi_id = $1",
        [bootEpi],
      )
    ).rows[0].id;
    await tx.query("select register_stock_entry($1, $2, $3::jsonb)", [
      a.orgId,
      location,
      JSON.stringify([
        { variant_id: glove, quantity: 50 },
        { variant_id: boot, quantity: 10 },
      ]),
    ]);
  });
});

describe("matriz com periodicidade", () => {
  it("sem periodicidade no cargo, a próxima troca usa a vida útil do EPI", async () => {
    await asUser(db, a.userId, (tx) =>
      tx.query(
        "insert into job_role_epi_requirements (organization_id, job_role_id, epi_id) values ($1, $2, $3)",
        [a.orgId, jobRole, gloveEpi],
      ),
    );
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    expect((await item(id)).next_replacement_at).toBe(await plusDays(30));
  });

  it("periodicidade do cargo sobrescreve a vida útil", async () => {
    await asUser(db, a.userId, (tx) =>
      tx.query(
        "update job_role_epi_requirements set replacement_days = 15, mandatory = false where job_role_id = $1 and epi_id = $2",
        [jobRole, gloveEpi],
      ),
    );
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    expect((await item(id)).next_replacement_at).toBe(await plusDays(15));
  });

  it("periodicidade precisa ser positiva", async () => {
    expect(
      await errorOf(
        asUser(db, a.userId, (tx) =>
          tx.query(
            "update job_role_epi_requirements set replacement_days = 0 where job_role_id = $1",
            [jobRole],
          ),
        ),
      ),
    ).toMatch(/check/);
  });
});

describe("snapshot e motivos", () => {
  it("grava a validade do CA no momento da entrega", async () => {
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    expect((await item(id)).ca_expires_at_snapshot).toBe("2099-12-31");
  });

  it("aceita o motivo novo devolucao_substituicao", async () => {
    const id = await deliver([
      { variant_id: glove, quantity: 1, reason: "devolucao_substituicao" },
    ]);
    expect((await item(id)).reason).toBe("devolucao_substituicao");
  });
});

describe("override de CA vencido", () => {
  it("sem override é bloqueado", async () => {
    expect(await errorOf(deliver([{ variant_id: boot, quantity: 1 }]))).toMatch(
      /ca_vencido/,
    );
  });

  it("almoxarife não pode liberar CA vencido", async () => {
    expect(
      await errorOf(
        deliver(
          [
            {
              variant_id: boot,
              quantity: 1,
              ca_override: true,
              ca_override_reason: REASON,
            },
          ],
          storekeeper,
        ),
      ),
    ).toMatch(/override_ca_restrito/);
  });

  it("proprietário precisa de justificativa (mínimo 10 caracteres)", async () => {
    expect(
      await errorOf(
        deliver([
          {
            variant_id: boot,
            quantity: 1,
            ca_override: true,
            ca_override_reason: "urgente",
          },
        ]),
      ),
    ).toMatch(/justificativa_obrigatoria/);
  });

  it("proprietário com justificativa entrega, grava o motivo e audita", async () => {
    const id = await deliver([
      {
        variant_id: boot,
        quantity: 1,
        ca_override: true,
        ca_override_reason: REASON,
      },
    ]);
    const it = await item(id);
    expect(it.ca_expired_override).toBe(true);
    expect(it.ca_override_reason).toBe(REASON);
    const audit = await db.query<{ j: string }>(
      "select new_data ->> 'justificativa' as j from audit_log where action = 'deliver_epis:ca_vencido' and record_id in (select id from epi_delivery_items where delivery_id = $1)",
      [id],
    );
    expect(audit.rows[0].j).toBe(REASON);
  });
});

describe("evidência da assinatura", () => {
  let id: string;

  it("assinatura grava hash de evidência que confere com os dados", async () => {
    id = await deliver([{ variant_id: glove, quantity: 1 }]);
    await asUser(db, storekeeper, (tx) =>
      tx.query(
        "select sign_delivery_in_person($1, 'desenho', $2, null, 'Tablet/1.0')",
        [id, PNG],
      ),
    );
    const { rows } = await db.query<{ evidence_hash: string }>(
      "select evidence_hash from signatures where delivery_id = $1",
      [id],
    );
    expect(rows[0].evidence_hash).toMatch(/^[0-9a-f]{64}$/);
    const ok = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ ok: boolean }>(
            "select verify_delivery_evidence($1) as ok",
            [id],
          )
        ).rows[0].ok,
    );
    expect(ok).toBe(true);
  });

  it("entrega assinada é imutável", async () => {
    expect(
      await errorOf(
        db.query(
          "update epi_delivery_items set quantity = 9 where delivery_id = $1",
          [id],
        ),
      ),
    ).toMatch(/registro_imutavel/);
    expect(
      await errorOf(
        db.query(
          "update signatures set ip = '1.1.1.1' where delivery_id = $1",
          [id],
        ),
      ),
    ).toMatch(/registro_imutavel/);
  });

  it("sem validade de CA, o hash é idêntico à fórmula anterior (entregas antigas continuam válidas)", async () => {
    const maskEpi = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "select create_epi($1, $2::jsonb) as id",
            [
              a.orgId,
              JSON.stringify({ name: "Máscara", category: "respiratoria" }),
            ],
          )
        ).rows[0].id,
    );
    const mask = (
      await db.query<{ id: string }>(
        "select id from epi_variants where epi_id = $1",
        [maskEpi],
      )
    ).rows[0].id;
    await asUser(db, a.userId, (tx) =>
      tx.query("select register_stock_entry($1, $2, $3::jsonb)", [
        a.orgId,
        location,
        JSON.stringify([{ variant_id: mask, quantity: 5 }]),
      ]),
    );
    const maskDelivery = await deliver([{ variant_id: mask, quantity: 1 }]);
    // Fórmula da migration 03, sem a chave ca_validade.
    const { rows } = await db.query<{ same: boolean }>(
      `select delivery_content_hash(d.id) = encode(sha256(convert_to(jsonb_build_object(
          'delivery_id', d.id,
          'organization_id', d.organization_id,
          'employee', jsonb_build_object('id', d.employee_id, 'name', d.employee_name_snapshot, 'cpf', d.employee_cpf_snapshot),
          'delivered_at', to_char(d.delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'term', d.term_text,
          'items', (select jsonb_agg(jsonb_build_object(
              'epi', i.epi_name_snapshot, 'size', i.size_label_snapshot, 'quantity', i.quantity,
              'ca', i.ca_number_snapshot, 'reason', i.reason)
            order by i.epi_name_snapshot, i.size_label_snapshot, i.id)
            from epi_delivery_items i where i.delivery_id = d.id)
        )::text, 'UTF8')), 'hex') as same
       from epi_deliveries d where d.id = $1`,
      [maskDelivery],
    );
    expect(rows[0].same).toBe(true);
  });
});

describe("dados de exemplo", () => {
  it("gera matriz com periodicidade e item não obrigatório", async () => {
    const demo = await makeOrg(db, "demo-a");
    await asUser(db, demo.userId, (tx) =>
      tx.query("select seed_demo_data($1)", [demo.orgId]),
    );
    const { rows } = await db.query<{ withPeriod: number; optional: number }>(
      `select count(*) filter (where replacement_days is not null)::int as "withPeriod",
              count(*) filter (where not mandatory)::int as optional
         from job_role_epi_requirements where organization_id = $1`,
      [demo.orgId],
    );
    expect(rows[0].withPeriod).toBeGreaterThan(0);
    expect(rows[0].optional).toBeGreaterThan(0);
  });
});
