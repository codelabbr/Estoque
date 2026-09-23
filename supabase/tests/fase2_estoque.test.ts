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
let b: { userId: string; orgId: string };
let viewerA: string;
let storekeeperA: string;
let locationA: string;
let variantA: string;
let variantB: string;

async function balance(variant = variantA, location = locationA) {
  const { rows } = await db.query<{ balance: number }>(
    "select coalesce(sum(signed_quantity), 0)::int as balance from stock_movements where variant_id = $1 and location_id = $2",
    [variant, location],
  );
  return rows[0].balance;
}

async function entry(user: string, quantity: number, unitCost?: number) {
  return asUser(
    db,
    user,
    async (tx) =>
      (
        await tx.query<{ g: string }>(
          "select register_stock_entry($1, $2, $3::jsonb, 'Fornecedor X', 'NF 123') as g",
          [
            a.orgId,
            locationA,
            JSON.stringify([
              { variant_id: variantA, quantity, unit_cost: unitCost },
            ]),
          ],
        )
      ).rows[0].g,
  );
}

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "est-a");
  b = await makeOrg(db, "est-b");
  viewerA = await addMember(db, a.orgId, "viewer", "viewer@est-a.dev");
  storekeeperA = await addMember(db, a.orgId, "storekeeper", "alm@est-a.dev");
  locationA = (
    await db.query<{ id: string }>(
      "select id from stock_locations where organization_id = $1 and is_default",
      [a.orgId],
    )
  ).rows[0].id;
  const epi = await asUser(
    db,
    a.userId,
    async (tx) =>
      (
        await tx.query<{ id: string }>(
          `select create_epi($1, '{"name":"Luva","category":"membros_superiores"}'::jsonb, array['M']) as id`,
          [a.orgId],
        )
      ).rows[0].id,
  );
  variantA = (
    await db.query<{ id: string }>(
      "select id from epi_variants where epi_id = $1",
      [epi],
    )
  ).rows[0].id;
  const epiB = await asUser(
    db,
    b.userId,
    async (tx) =>
      (
        await tx.query<{ id: string }>(
          `select create_epi($1, '{"name":"Luva B","category":"membros_superiores"}'::jsonb) as id`,
          [b.orgId],
        )
      ).rows[0].id,
  );
  variantB = (
    await db.query<{ id: string }>(
      "select id from epi_variants where epi_id = $1",
      [epiB],
    )
  ).rows[0].id;
});

describe("locais", () => {
  it("toda organização nasce com um almoxarifado padrão", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from stock_locations where is_default",
    );
    expect(rows[0].n).toBe(2);
  });
});

describe("entrada", () => {
  it("almoxarife registra entrada e o saldo soma", async () => {
    await entry(storekeeperA, 10, 12.5);
    expect(await balance()).toBe(10);
  });

  it("viewer não registra entrada", async () => {
    expect(await errorOf(entry(viewerA, 1))).toMatch(/permissao_negada/);
  });

  it("não aceita item de outra organização", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select register_stock_entry($1, $2, $3::jsonb)", [
          a.orgId,
          locationA,
          JSON.stringify([{ variant_id: variantB, quantity: 5 }]),
        ]),
      ),
    );
    expect(err).toMatch(/item_invalido/);
  });

  it("usuário de outra organização não usa o local da org A", async () => {
    const err = await errorOf(
      asUser(db, b.userId, (tx) =>
        tx.query("select register_stock_entry($1, $2, $3::jsonb)", [
          a.orgId,
          locationA,
          JSON.stringify([{ variant_id: variantA, quantity: 5 }]),
        ]),
      ),
    );
    expect(err).toMatch(/permissao_negada/);
  });

  it("entrada com vários itens é atômica (um inválido cancela tudo)", async () => {
    const before = await balance();
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select register_stock_entry($1, $2, $3::jsonb)", [
          a.orgId,
          locationA,
          JSON.stringify([
            { variant_id: variantA, quantity: 5 },
            { variant_id: variantA, quantity: 0 },
          ]),
        ]),
      ),
    );
    expect(err).toMatch(/quantidade_invalida/);
    expect(await balance()).toBe(before);
  });
});

describe("ajustes, descarte e saldo", () => {
  it("ajuste exige motivo", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select adjust_stock($1, $2, $3, -1, '')", [
          a.orgId,
          locationA,
          variantA,
        ]),
      ),
    );
    expect(err).toMatch(/motivo_obrigatorio/);
  });

  it("saída maior que o saldo falha com saldo_insuficiente", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select discard_stock($1, $2, $3, 999, 'Vencido')", [
          a.orgId,
          locationA,
          variantA,
        ]),
      ),
    );
    expect(err).toMatch(/saldo_insuficiente/);
  });

  it("descarte e ajuste negativo subtraem; positivo soma", async () => {
    const before = await balance();
    await asUser(db, a.userId, async (tx) => {
      await tx.query("select discard_stock($1, $2, $3, 2, 'Danificado')", [
        a.orgId,
        locationA,
        variantA,
      ]);
      await tx.query("select adjust_stock($1, $2, $3, -1, 'Contagem')", [
        a.orgId,
        locationA,
        variantA,
      ]);
      await tx.query("select adjust_stock($1, $2, $3, 3, 'Achado')", [
        a.orgId,
        locationA,
        variantA,
      ]);
    });
    expect(await balance()).toBe(before - 2 - 1 + 3);
  });
});

describe("inventário", () => {
  it("gera ajustes só para as diferenças", async () => {
    const current = await balance();
    const result = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ r: { adjusted: number } }>(
            "select apply_inventory($1, $2, $3::jsonb, 'Inventário 23/09/2026') as r",
            [
              a.orgId,
              locationA,
              JSON.stringify([{ variant_id: variantA, counted: current + 4 }]),
            ],
          )
        ).rows[0].r,
    );
    expect(result.adjusted).toBe(1);
    expect(await balance()).toBe(current + 4);
  });
});

describe("estorno", () => {
  it("estorna uma entrada uma única vez", async () => {
    const group = await entry(a.userId, 5, 20);
    const movement = (
      await db.query<{ id: string }>(
        "select id from stock_movements where group_id = $1",
        [group],
      )
    ).rows[0].id;
    const before = await balance();
    await asUser(db, a.userId, (tx) =>
      tx.query("select reverse_stock_movement($1, 'Lançado em duplicidade')", [
        movement,
      ]),
    );
    expect(await balance()).toBe(before - 5);
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select reverse_stock_movement($1, 'De novo')", [movement]),
      ),
    );
    expect(err).toMatch(/movimento_ja_estornado/);
  });

  it("estorno de entrada não pode deixar saldo negativo", async () => {
    const group = await entry(a.userId, 100);
    const movement = (
      await db.query<{ id: string }>(
        "select id from stock_movements where group_id = $1",
        [group],
      )
    ).rows[0].id;
    const all = await balance();
    await asUser(db, a.userId, (tx) =>
      tx.query("select discard_stock($1, $2, $3, $4, 'Esvaziar')", [
        a.orgId,
        locationA,
        variantA,
        all,
      ]),
    );
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select reverse_stock_movement($1, 'Estorno')", [movement]),
      ),
    );
    expect(err).toMatch(/saldo_insuficiente/);
  });

  it("estorno não é estornável", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from stock_movements where type = 'estorno' limit 1",
    );
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select reverse_stock_movement($1, 'x y z')", [rows[0].id]),
      ),
    );
    expect(err).toMatch(/movimento_nao_estornavel/);
  });
});

describe("ledger imutável e RLS", () => {
  it("UPDATE e DELETE no ledger falham", async () => {
    expect(
      await errorOf(db.query("update stock_movements set quantity = 1")),
    ).toMatch(/registro_imutavel/);
    expect(await errorOf(db.query("delete from stock_movements"))).toMatch(
      /registro_imutavel/,
    );
  });

  it("insert direto por usuário é bloqueado (só via RPC)", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "insert into stock_movements (organization_id, location_id, variant_id, type, quantity, direction) values ($1, $2, $3, 'entrada', 1, 1)",
          [a.orgId, locationA, variantA],
        ),
      ),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("usuário da org B não vê movimentos da org A", async () => {
    const rows = await asUser(
      db,
      b.userId,
      async (tx) =>
        (
          await tx.query(
            "select 1 from stock_movements where organization_id = $1",
            [a.orgId],
          )
        ).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("v_stock_balance respeita RLS e calcula custo médio", async () => {
    const rows = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{
            organization_id: string;
            balance: number;
            avg_cost: string | null;
          }>("select organization_id, balance, avg_cost from v_stock_balance")
        ).rows,
    );
    expect(rows.every((r) => r.organization_id === a.orgId)).toBe(true);
    // Entradas com custo válidas: 10 × 12,50 (a de 5 × 20 foi estornada)
    expect(Number(rows[0].avg_cost)).toBe(12.5);
  });
});
