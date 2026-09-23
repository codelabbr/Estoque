import { createHash, randomBytes } from "node:crypto";
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
let location: string;
let employee: string;
let glove: string; // variante com saldo e CA válido
let boot: string; // variante com saldo e CA vencido
let mask: string; // variante sem saldo

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  randomBytes(200),
]);
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

async function variantOf(epiId: string) {
  return (
    await db.query<{ id: string }>(
      "select id from epi_variants where epi_id = $1",
      [epiId],
    )
  ).rows[0].id;
}

async function balance(variant: string) {
  const { rows } = await db.query<{ b: number }>(
    "select coalesce(sum(signed_quantity),0)::int as b from stock_movements where variant_id = $1",
    [variant],
  );
  return rows[0].b;
}

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

async function newLink(deliveryId: string) {
  const token = randomBytes(32).toString("base64url");
  await asUser(db, a.userId, (tx) =>
    tx.query("select create_signature_request($1, 'link', $2)", [
      deliveryId,
      sha(token),
    ]),
  );
  return token;
}

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "ent-a");
  b = await makeOrg(db, "ent-b");
  viewerA = await addMember(db, a.orgId, "viewer", "viewer@ent-a.dev");
  location = (
    await db.query<{ id: string }>(
      "select id from stock_locations where organization_id = $1",
      [a.orgId],
    )
  ).rows[0].id;

  await asUser(db, a.userId, async (tx) => {
    employee = (
      await tx.query<{ id: string }>(
        "insert into employees (organization_id, full_name, cpf) values ($1, 'Ana Maria Souza', '52998224725') returning id",
        [a.orgId],
      )
    ).rows[0].id;
    const mk = async (json: object) =>
      (
        await tx.query<{ id: string }>(
          "select create_epi($1, $2::jsonb) as id",
          [a.orgId, JSON.stringify(json)],
        )
      ).rows[0].id;
    glove = await mk({
      name: "Luva",
      category: "membros_superiores",
      ca_number: "11111",
      ca_expires_at: "2099-12-31",
      lifespan_days: "30",
    });
    boot = await mk({
      name: "Botina",
      category: "membros_inferiores",
      ca_number: "22222",
      ca_expires_at: "2000-01-01",
    });
    mask = await mk({ name: "Máscara", category: "respiratoria" });
  });
  glove = await variantOf(glove);
  boot = await variantOf(boot);
  mask = await variantOf(mask);
  await asUser(db, a.userId, (tx) =>
    tx.query("select register_stock_entry($1, $2, $3::jsonb)", [
      a.orgId,
      location,
      JSON.stringify([
        { variant_id: glove, quantity: 50 },
        { variant_id: boot, quantity: 5 },
      ]),
    ]),
  );
});

describe("deliver_epis", () => {
  let deliveryId: string;

  it("entrega feliz: baixa estoque, grava itens com snapshot, hash e status pendente", async () => {
    deliveryId = await deliver([
      { variant_id: glove, quantity: 2, reason: "primeira_entrega" },
    ]);
    expect(await balance(glove)).toBe(48);
    const { rows } = await db.query<{
      signature_status: string;
      content_hash: string;
      ok: boolean;
    }>(
      "select signature_status, content_hash, content_hash = delivery_content_hash(id) as ok from epi_deliveries where id = $1",
      [deliveryId],
    );
    expect(rows[0]).toMatchObject({ signature_status: "pendente", ok: true });
    expect(rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    const item = await db.query<{
      ca_number_snapshot: string;
      next_replacement_at: string | Date;
    }>(
      "select ca_number_snapshot, next_replacement_at from epi_delivery_items where delivery_id = $1",
      [deliveryId],
    );
    expect(item.rows[0].ca_number_snapshot).toBe("11111");
    expect(item.rows[0].next_replacement_at).not.toBeNull();
  });

  it("saldo insuficiente em 1 de 2 itens: nada é gravado (atomicidade)", async () => {
    const before = await balance(glove);
    const count = async () =>
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from epi_deliveries",
        )
      ).rows[0].n;
    const deliveries = await count();
    const err = await errorOf(
      deliver([
        { variant_id: glove, quantity: 1 },
        { variant_id: mask, quantity: 1 },
      ]),
    );
    expect(err).toMatch(/saldo_insuficiente/);
    expect(await balance(glove)).toBe(before);
    expect(await count()).toBe(deliveries);
  });

  it("CA vencido sem override falha; com override grava a flag e audita", async () => {
    expect(await errorOf(deliver([{ variant_id: boot, quantity: 1 }]))).toMatch(
      /ca_vencido/,
    );
    const id = await deliver([
      { variant_id: boot, quantity: 1, ca_override: true },
    ]);
    const { rows } = await db.query<{ ca_expired_override: boolean }>(
      "select ca_expired_override from epi_delivery_items where delivery_id = $1",
      [id],
    );
    expect(rows[0].ca_expired_override).toBe(true);
    const audit = await db.query<{ n: number }>(
      "select count(*)::int n from audit_log where action = 'deliver_epis:ca_vencido'",
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("viewer e outra organização não entregam", async () => {
    expect(
      await errorOf(deliver([{ variant_id: glove, quantity: 1 }], viewerA)),
    ).toMatch(/permissao_negada/);
    expect(
      await errorOf(deliver([{ variant_id: glove, quantity: 1 }], b.userId)),
    ).toMatch(/permissao_negada/);
  });

  it("funcionário desligado não recebe entrega", async () => {
    const other = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "insert into employees (organization_id, full_name, cpf, terminated_at) values ($1, 'Ex Funcionário', '11144477735', '2026-01-01') returning id",
            [a.orgId],
          )
        ).rows[0].id,
    );
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select deliver_epis($1, $2, $3, $4::jsonb)", [
          a.orgId,
          other,
          location,
          JSON.stringify([{ variant_id: glove, quantity: 1 }]),
        ]),
      ),
    );
    expect(err).toMatch(/funcionario_desligado/);
  });

  it("entrega e itens são imutáveis", async () => {
    expect(
      await errorOf(
        db.query("update epi_deliveries set notes = 'x' where id = $1", [
          deliveryId,
        ]),
      ),
    ).toMatch(/registro_imutavel/);
    expect(
      await errorOf(
        db.query(
          "update epi_delivery_items set quantity = 9 where delivery_id = $1",
          [deliveryId],
        ),
      ),
    ).toMatch(/registro_imutavel/);
    expect(
      await errorOf(
        db.query("delete from epi_deliveries where id = $1", [deliveryId]),
      ),
    ).toMatch(/registro_imutavel/);
  });
});

describe("assinatura por link", () => {
  it("anon lê só os dados mínimos (primeiro nome, CPF mascarado)", async () => {
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    const token = await newLink(id);
    const data = await asAnon(
      db,
      async (tx) =>
        (
          await tx.query<{ r: Record<string, unknown> }>(
            "select get_signature_request($1) as r",
            [token],
          )
        ).rows[0].r,
    );
    expect(data.first_name).toBe("Ana");
    expect(data.cpf_masked).toBe("***.982.247-**");
    expect(JSON.stringify(data)).not.toContain("52998224725");
  });

  it("assina com o token uma única vez", async () => {
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    const token = await newLink(id);
    await asAnon(db, (tx) =>
      tx.query(
        "select sign_delivery($1, 'desenho', $2, null, '189.1.2.3', 'Mozilla')",
        [token, PNG],
      ),
    );
    const { rows } = await db.query<{ signature_status: string }>(
      "select signature_status from epi_deliveries where id = $1",
      [id],
    );
    expect(rows[0].signature_status).toBe("assinada");
    const again = await errorOf(
      asAnon(db, (tx) =>
        tx.query("select sign_delivery($1, 'desenho', $2)", [token, PNG]),
      ),
    );
    expect(again).toMatch(/token_usado/);
  });

  it("token inexistente, expirado ou cancelado falha sem gravar", async () => {
    expect(
      await errorOf(
        asAnon(db, (tx) =>
          tx.query("select get_signature_request('nao-existe')"),
        ),
      ),
    ).toMatch(/token_invalido/);

    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    const oldToken = await newLink(id);
    const newToken = await newLink(id); // reenviar cancela o anterior
    expect(
      await errorOf(
        asAnon(db, (tx) =>
          tx.query("select sign_delivery($1, 'desenho', $2)", [oldToken, PNG]),
        ),
      ),
    ).toMatch(/token_cancelado/);

    await db.query(
      "alter table signature_requests disable trigger guard_signature_requests",
    );
    await db.query(
      "update signature_requests set expires_at = now() - interval '1 minute' where token_hash = $1",
      [sha(newToken)],
    );
    await db.query(
      "alter table signature_requests enable trigger guard_signature_requests",
    );
    expect(
      await errorOf(
        asAnon(db, (tx) =>
          tx.query("select sign_delivery($1, 'desenho', $2)", [newToken, PNG]),
        ),
      ),
    ).toMatch(/token_expirado/);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int n from signatures where delivery_id = $1",
      [id],
    );
    expect(rows[0].n).toBe(0);
  });

  it("conteúdo alterado após a entrega invalida a assinatura", async () => {
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    const token = await newLink(id);
    await db.query(
      "alter table epi_delivery_items disable trigger guard_epi_delivery_items",
    );
    await db.query(
      "update epi_delivery_items set quantity = 5 where delivery_id = $1",
      [id],
    );
    await db.query(
      "alter table epi_delivery_items enable trigger guard_epi_delivery_items",
    );
    expect(
      await errorOf(
        asAnon(db, (tx) =>
          tx.query("select sign_delivery($1, 'desenho', $2)", [token, PNG]),
        ),
      ),
    ).toMatch(/conteudo_alterado/);
  });

  it("anon não lê tabelas de entrega nem assinaturas", async () => {
    const rows = await asAnon(db, async (tx) => [
      ...(await tx.query("select 1 from epi_deliveries")).rows,
      ...(await tx.query("select 1 from signatures")).rows,
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("assinatura na tela", () => {
  it("assina por nome digitado", async () => {
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    await asUser(db, a.userId, (tx) =>
      tx.query(
        "select sign_delivery_in_person($1, 'nome_digitado', null, 'Ana Maria Souza')",
        [id],
      ),
    );
    const { rows } = await db.query<{ method: string; typed_name: string }>(
      "select method, typed_name from signatures where delivery_id = $1",
      [id],
    );
    expect(rows[0]).toEqual({
      method: "nome_digitado",
      typed_name: "Ana Maria Souza",
    });
  });

  it("assinatura desenhada vazia é rejeitada", async () => {
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    expect(
      await errorOf(
        asUser(db, a.userId, (tx) =>
          tx.query("select sign_delivery_in_person($1, 'desenho', $2)", [
            id,
            Buffer.from([1, 2, 3]),
          ]),
        ),
      ),
    ).toMatch(/assinatura_vazia/);
  });
});

describe("cancelamento e devolução", () => {
  it("cancelar entrega pendente devolve o estoque", async () => {
    const before = await balance(glove);
    const id = await deliver([{ variant_id: glove, quantity: 3 }]);
    expect(await balance(glove)).toBe(before - 3);
    await asUser(db, a.userId, (tx) =>
      tx.query("select cancel_delivery($1, 'Lançada errada')", [id]),
    );
    expect(await balance(glove)).toBe(before);
    const { rows } = await db.query<{ signature_status: string }>(
      "select signature_status from epi_deliveries where id = $1",
      [id],
    );
    expect(rows[0].signature_status).toBe("cancelada");
  });

  it("entrega assinada não pode ser cancelada", async () => {
    const id = await deliver([{ variant_id: glove, quantity: 1 }]);
    await asUser(db, a.userId, (tx) =>
      tx.query(
        "select sign_delivery_in_person($1, 'nome_digitado', null, 'Ana Souza')",
        [id],
      ),
    );
    expect(
      await errorOf(
        asUser(db, a.userId, (tx) =>
          tx.query("select cancel_delivery($1, 'Tentativa')", [id]),
        ),
      ),
    ).toMatch(/entrega_nao_cancelavel/);
  });

  it("devolução para estoque soma; para descarte não soma; só uma vez", async () => {
    const id = await deliver([
      { variant_id: glove, quantity: 1 },
      { variant_id: boot, quantity: 1, ca_override: true },
    ]);
    const items = (
      await db.query<{ id: string; variant_id: string }>(
        "select id, variant_id from epi_delivery_items where delivery_id = $1",
        [id],
      )
    ).rows;
    const gloveItem = items.find((i) => i.variant_id === glove)!.id;
    const bootItem = items.find((i) => i.variant_id === boot)!.id;
    const gBefore = await balance(glove);
    const bBefore = await balance(boot);
    await asUser(db, a.userId, async (tx) => {
      await tx.query("select return_epi($1, 'estoque', 'Sem uso')", [
        gloveItem,
      ]);
      await tx.query("select return_epi($1, 'descarte', 'Rasgada')", [
        bootItem,
      ]);
    });
    expect(await balance(glove)).toBe(gBefore + 1);
    expect(await balance(boot)).toBe(bBefore);
    expect(
      await errorOf(
        asUser(db, a.userId, (tx) =>
          tx.query("select return_epi($1, 'estoque')", [gloveItem]),
        ),
      ),
    ).toMatch(/item_ja_devolvido/);
  });

  it("v_employee_epi_holdings mostra só itens em posse", async () => {
    const rows = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ signature_status: string }>(
            "select signature_status from v_employee_epi_holdings where employee_id = $1",
            [employee],
          )
        ).rows,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.signature_status !== "cancelada")).toBe(true);
  });
});
