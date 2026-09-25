import { beforeAll, describe, expect, it } from "vitest";
import {
  asUser,
  asService,
  createTestDb,
  errorOf,
  makeOrg,
  type TestDb,
} from "./harness";

type Pendencia = {
  tipo: string;
  severidade: "irregular" | "aviso";
  item: string;
  item_id: string;
  data_referencia: string | null;
};
type Linha = { employee_id: string; status: string; pendencias: Pendencia[] };

let db: TestDb;
let a: { userId: string; orgId: string };
let b: { userId: string; orgId: string };
let location: string;
let jobRole: string;

const SIGN_PNG = Buffer.alloc(300, 7);

async function q<T>(sql: string, params: unknown[] = [], user = a.userId) {
  return asUser(db, user, async (tx) => (await tx.query<T>(sql, params)).rows);
}

async function conformidade(user = a.userId, org = a.orgId) {
  return q<Linha>(
    "select employee_id, status, pendencias from fn_conformidade_funcionarios($1)",
    [org],
    user,
  );
}
async function of(employee: string) {
  return (await conformidade()).find((l) => l.employee_id === employee)!;
}
const tipos = (l: Linha) => l.pendencias.map((p) => p.tipo);

async function newEmployee(name: string, cpf: string) {
  return (
    await q<{ id: string }>(
      "insert into employees (organization_id, full_name, cpf, job_role_id) values ($1, $2, $3, $4) returning id",
      [a.orgId, name, cpf, jobRole],
    )
  )[0].id;
}

async function newEpi(json: object) {
  const epi = (
    await q<{ id: string }>("select create_epi($1, $2::jsonb) as id", [
      a.orgId,
      JSON.stringify(json),
    ])
  )[0].id;
  const variant = (
    await db.query<{ id: string }>(
      "select id from epi_variants where epi_id = $1",
      [epi],
    )
  ).rows[0].id;
  await q("select register_stock_entry($1, $2, $3::jsonb)", [
    a.orgId,
    location,
    JSON.stringify([{ variant_id: variant, quantity: 50 }]),
  ]);
  return { epi, variant };
}

async function requireEpi(epi: string, extra = "") {
  await q(
    `insert into job_role_epi_requirements (organization_id, job_role_id, epi_id${extra ? ", replacement_days" : ""})
     values ($1, $2, $3${extra ? ", $4" : ""})`,
    extra ? [a.orgId, jobRole, epi, Number(extra)] : [a.orgId, jobRole, epi],
  );
}

/** Entrega "no passado" via função interna (como os dados de exemplo). */
async function deliverAt(
  employee: string,
  variant: string,
  daysAgo: number,
  opts: { sign?: boolean; override?: boolean } = {},
) {
  const id = await asUser(db, a.userId, async (tx) => {
    await tx.exec("reset role"); // deliver_epis_at não é exposta ao authenticated
    return (
      await tx.query<{ id: string }>(
        "select deliver_epis_at($1, $2, $3, $4::jsonb, null, now() - make_interval(days => $5)) as id",
        [
          a.orgId,
          employee,
          location,
          JSON.stringify([
            {
              variant_id: variant,
              quantity: 1,
              ...(opts.override
                ? {
                    ca_override: true,
                    ca_override_reason: "Uso emergencial registrado no teste",
                  }
                : {}),
            },
          ]),
          daysAgo,
        ],
      )
    ).rows[0].id;
  });
  if (opts.sign !== false)
    await q("select sign_delivery_in_person($1, 'desenho', $2)", [
      id,
      SIGN_PNG,
    ]);
  return id;
}

beforeAll(async () => {
  db = await createTestDb();
  a = await makeOrg(db, "conf-a");
  b = await makeOrg(db, "conf-b");
  location = (
    await db.query<{ id: string }>(
      "select id from stock_locations where organization_id = $1",
      [a.orgId],
    )
  ).rows[0].id;
  jobRole = (
    await q<{ id: string }>(
      "insert into job_roles (organization_id, name) values ($1, 'Montador') returning id",
      [a.orgId],
    )
  )[0].id;
});

describe("fn_conformidade_funcionarios", () => {
  it("sem matriz nem treinamentos exigidos, o funcionário está em dia", async () => {
    const emp = await newEmployee("Sem Pendências", "52998224725");
    const l = await of(emp);
    expect(l.status).toBe("em_dia");
    expect(l.pendencias).toEqual([]);
  });

  it("epi_obrigatorio_nunca_entregue: está na matriz e não tem entrega", async () => {
    const { epi } = await newEpi({
      name: "Botina",
      category: "membros_inferiores",
    });
    await requireEpi(epi);
    const emp = await newEmployee("Nunca Recebeu", "11144477735");
    const l = await of(emp);
    expect(l.status).toBe("irregular");
    expect(tipos(l)).toContain("epi_obrigatorio_nunca_entregue");
  });

  it("EPI recomendado (não obrigatório) não conta", async () => {
    const { epi } = await newEpi({ name: "Protetor", category: "auditiva" });
    await q(
      "insert into job_role_epi_requirements (organization_id, job_role_id, epi_id, mandatory) values ($1, $2, $3, false)",
      [a.orgId, jobRole, epi],
    );
    const emp = await newEmployee("Recomendado", "39053344705");
    expect(
      (await of(emp)).pendencias.filter((p) => p.item === "Protetor"),
    ).toEqual([]);
  });

  it("troca_vencida e troca_vencendo usam a periodicidade do cargo", async () => {
    const { epi, variant } = await newEpi({
      name: "Luva",
      category: "membros_superiores",
      lifespan_days: "90",
    });
    await requireEpi(epi, "15"); // cargo troca a cada 15 dias
    const late = await newEmployee("Troca Vencida", "86288366757");
    const soon = await newEmployee("Troca Vencendo", "71428793860");
    await deliverAt(late, variant, 20); // venceu há 5 dias
    await deliverAt(soon, variant, 10); // vence em 5 dias
    const lLate = await of(late);
    const vencida = lLate.pendencias.find((p) => p.tipo === "troca_vencida");
    expect(vencida?.item).toBe("Luva");
    expect(vencida?.severidade).toBe("irregular");
    const lSoon = await of(soon);
    const vencendo = lSoon.pendencias.find((p) => p.tipo === "troca_vencendo");
    expect(vencendo?.severidade).toBe("aviso");
    expect(tipos(lSoon)).not.toContain("troca_vencida");
  });

  it("troca_vencendo sozinha não torna irregular", async () => {
    const { epi, variant } = await newEpi({
      name: "Luva nitrílica",
      category: "membros_superiores",
      lifespan_days: "8",
    });
    await q("delete from job_role_epi_requirements where job_role_id = $1", [
      jobRole,
    ]);
    await requireEpi(epi);
    const emp = await newEmployee("Só Aviso", "04542856046");
    await deliverAt(emp, variant, 3); // vence em 5 dias
    const l = await of(emp);
    expect(tipos(l)).toEqual(["troca_vencendo"]);
    expect(l.status).toBe("em_dia");
  });

  it("ca_vencido_em_uso: o CA da última entrega está vencido", async () => {
    const { variant } = await newEpi({
      name: "Máscara",
      category: "respiratoria",
      ca_number: "67890",
      ca_expires_at: "2020-01-31",
    });
    const emp = await newEmployee("CA Vencido", "28625587887");
    await deliverAt(emp, variant, 1, { override: true });
    const l = await of(emp);
    const p = l.pendencias.find((x) => x.tipo === "ca_vencido_em_uso");
    expect(p?.item).toContain("CA 67890");
    expect(String(p?.data_referencia)).toBe("2020-01-31");
    expect(l.status).toBe("irregular");
  });

  it("entrega_sem_assinatura", async () => {
    const { variant } = await newEpi({
      name: "Óculos",
      category: "olhos_face",
    });
    const emp = await newEmployee("Sem Assinatura", "93541134780");
    const delivery = await deliverAt(emp, variant, 0, { sign: false });
    const l = await of(emp);
    const p = l.pendencias.find((x) => x.tipo === "entrega_sem_assinatura");
    expect(p?.item_id).toBe(delivery);
    expect(l.status).toBe("irregular");
    await q("select sign_delivery_in_person($1, 'desenho', $2)", [
      delivery,
      SIGN_PNG,
    ]);
    expect(tipos(await of(emp))).not.toContain("entrega_sem_assinatura");
  });

  it("treinamento_nunca_realizado, treinamento_vencido e treinamento_vencendo", async () => {
    await q("delete from job_role_epi_requirements where job_role_id = $1", [
      jobRole,
    ]);
    const nr35 = (
      await q<{ id: string }>(
        "insert into training_types (organization_id, name, regulation, validity_months) values ($1, 'NR-35 Teste', 'NR-35', 24) returning id",
        [a.orgId],
      )
    )[0].id;
    await q(
      "insert into job_role_training_requirements (organization_id, job_role_id, training_type_id) values ($1, $2, $3)",
      [a.orgId, jobRole, nr35],
    );
    const never = await newEmployee("Nunca Treinou", "07068093868");
    const expired = await newEmployee("Treino Vencido", "15350946056");
    const expiring = await newEmployee("Treino Vencendo", "46287416090");
    const add = (emp: string, daysAgo: number) =>
      q(
        "insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at) values ($1, $2, $3, sao_paulo_today() - $4::int)",
        [a.orgId, emp, nr35, daysAgo],
      );
    await add(expired, 800); // 24 meses = ~730 dias
    await add(expiring, 720); // vence em ~10 dias

    expect(tipos(await of(never))).toContain("treinamento_nunca_realizado");
    const lExp = await of(expired);
    expect(tipos(lExp)).toContain("treinamento_vencido");
    expect(lExp.status).toBe("irregular");
    const lSoon = await of(expiring);
    expect(tipos(lSoon)).toContain("treinamento_vencendo");
    expect(
      lSoon.pendencias.find((p) => p.tipo === "treinamento_vencendo")
        ?.severidade,
    ).toBe("aviso");
  });

  it("v_employee_compliance usa o mesmo motor (ok / atencao / irregular)", async () => {
    const rows = await q<{ employee_id: string; status: string }>(
      "select employee_id, status from v_employee_compliance where organization_id = $1",
      [a.orgId],
    );
    const fn = await conformidade();
    for (const r of rows) {
      const l = fn.find((x) => x.employee_id === r.employee_id)!;
      expect(r.status === "irregular").toBe(l.status === "irregular");
    }
  });

  it("isolamento: outra organização não vê nada", async () => {
    expect(await conformidade(b.userId, a.orgId)).toEqual([]);
    const issues = await q<{ n: number }>(
      "select count(*)::int as n from v_compliance_issues",
      [],
      b.userId,
    );
    expect(issues[0].n).toBe(0);
  });
});

describe("entrega e assinatura", () => {
  it("deliver_epis_at não pode ser chamada pelo app", async () => {
    expect(
      await errorOf(
        q("select deliver_epis_at($1, $2, $3, '[]'::jsonb, null, now())", [
          a.orgId,
          a.orgId,
          location,
        ]),
      ),
    ).toMatch(/permission denied/);
  });

  it("assinatura presencial grava o IP e a evidência confere", async () => {
    const { variant } = await newEpi({ name: "Capacete", category: "cabeca" });
    const emp = await newEmployee("Com IP", "74582358088");
    const delivery = await deliverAt(emp, variant, 0, { sign: false });
    await q(
      "select sign_delivery_in_person($1, 'desenho', $2, null, 'Tablet/1.0', '203.0.113.7')",
      [delivery, SIGN_PNG],
    );
    const s = await asService(
      db,
      async (tx) =>
        (
          await tx.query<{ ip: string }>(
            "select host(ip) as ip from signatures where delivery_id = $1",
            [delivery],
          )
        ).rows[0],
    );
    expect(s.ip).toBe("203.0.113.7");
    const ok = await q<{ ok: boolean }>(
      "select verify_delivery_evidence($1) as ok",
      [delivery],
    );
    expect(ok[0].ok).toBe(true);
  });

  it("EPI pode exigir um treinamento (grava pelo create_epi)", async () => {
    const t = (
      await q<{ id: string }>(
        "select id from training_types where organization_id = $1 limit 1",
        [a.orgId],
      )
    )[0].id;
    const { epi } = await newEpi({
      name: "Cinto paraquedista",
      category: "quedas",
      required_training_type_id: t,
    });
    const r = await db.query<{ t: string }>(
      "select required_training_type_id as t from epis where id = $1",
      [epi],
    );
    expect(r.rows[0].t).toBe(t);
  });
});

describe("dados de exemplo", () => {
  it("cobrem todos os tipos de pendência", async () => {
    const demo = await makeOrg(db, "conf-demo");
    await asUser(db, demo.userId, (tx) =>
      tx.query("select seed_demo_data($1)", [demo.orgId]),
    );
    const linhas = await conformidade(demo.userId, demo.orgId);
    const todos = new Set(linhas.flatMap(tipos));
    for (const t of [
      "epi_obrigatorio_nunca_entregue",
      "troca_vencida",
      "troca_vencendo",
      "ca_vencido_em_uso",
      "entrega_sem_assinatura",
      "treinamento_nunca_realizado",
      "treinamento_vencido",
      "treinamento_vencendo",
    ])
      expect(todos, t).toContain(t);
    const statuses = new Set(linhas.map((l) => l.status));
    expect(statuses).toEqual(new Set(["em_dia", "irregular"]));
  });
});
