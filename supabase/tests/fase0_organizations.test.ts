import { beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  asAnon,
  asUser,
  createTestDb,
  createUser,
  errorOf,
  makeOrg,
  type TestDb,
} from "./harness";

let db: TestDb;
let a: { userId: string; orgId: string };
let b: { userId: string; orgId: string };

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "empresa-a");
  b = await makeOrg(db, "empresa-b");
});

describe("organizations (RLS)", () => {
  it("usuário vê só a própria organização", async () => {
    const rows = await asUser(
      db,
      a.userId,
      async (tx) =>
        (await tx.query<{ id: string }>("select id from organizations")).rows,
    );
    expect(rows.map((r) => r.id)).toEqual([a.orgId]);
  });

  it("update em outra organização não afeta nada", async () => {
    await asUser(db, a.userId, (tx) =>
      tx.query("update organizations set name = 'Hackeado' where id = $1", [
        b.orgId,
      ]),
    );
    const { rows } = await db.query<{ name: string }>(
      "select name from organizations where id = $1",
      [b.orgId],
    );
    expect(rows[0].name).toBe("Empresa empresa-b");
  });

  it("anon não lê organizações", async () => {
    const rows = await asAnon(
      db,
      async (tx) => (await tx.query("select 1 from organizations")).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("create_organization exige usuário autenticado", async () => {
    const err = await errorOf(
      db.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.query("select create_organization('Sem dono', 'sem-dono')");
      }),
    );
    expect(err).toMatch(/nao_autenticado/);
  });
});

describe("organization_members (RLS e último owner)", () => {
  it("viewer não adiciona membros", async () => {
    const viewer = await addMember(db, a.orgId, "viewer", "viewer-a@t.dev");
    const outsider = await createUser(db, "outsider@t.dev");
    const err = await errorOf(
      asUser(db, viewer, (tx) =>
        tx.query(
          "insert into organization_members (organization_id, user_id, role) values ($1, $2, 'admin')",
          [a.orgId, outsider],
        ),
      ),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("não remove o último owner", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "delete from organization_members where organization_id = $1 and user_id = $2",
          [a.orgId, a.userId],
        ),
      ),
    );
    expect(err).toMatch(/ultimo_owner_organizacao/);
  });

  it("audit_log é imutável", async () => {
    const err = await errorOf(db.query("delete from audit_log"));
    expect(err).toMatch(/registro_imutavel/);
  });
});

describe("list_org_members", () => {
  it("membro vê e-mails da própria organização", async () => {
    const rows = await asUser(
      db,
      a.userId,
      async (tx) =>
        (
          await tx.query<{ email: string }>(
            "select email from list_org_members($1)",
            [a.orgId],
          )
        ).rows,
    );
    expect(rows.map((r) => r.email)).toContain("empresa-a@teste.almoxsst.dev");
  });

  it("não lista membros de outra organização", async () => {
    const err = await errorOf(
      asUser(db, a.userId, (tx) =>
        tx.query("select * from list_org_members($1)", [b.orgId]),
      ),
    );
    expect(err).toMatch(/permissao_negada/);
  });
});
