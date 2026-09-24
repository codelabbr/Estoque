import { expect, test, type Page } from "@playwright/test";

/**
 * Fluxos autenticados (skill testes-qualidade). Rodam contra um usuário de
 * teste já existente, com organização criada:
 *   E2E_EMAIL, E2E_PASSWORD e E2E_ORG_SLUG
 * Sem essas variáveis, são pulados (nunca use o banco de produção com dados reais).
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const org = process.env.E2E_ORG_SLUG;

test.skip(
  !email || !password || !org,
  "Defina E2E_EMAIL, E2E_PASSWORD e E2E_ORG_SLUG para rodar os fluxos autenticados.",
);

async function login(page: Page) {
  await page.goto(`/login?next=/${org}/dashboard`);
  await page.getByLabel("E-mail", { exact: true }).fill(email!);
  await page.getByLabel("Senha", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/${org}/dashboard`));
}

test("navega pelos módulos principais", async ({ page }) => {
  await login(page);
  for (const [path, heading] of [
    ["funcionarios", "Funcionários"],
    ["epis", "EPIs"],
    ["estoque", "Estoque"],
    ["entregas", "Entregas"],
    ["treinamentos", "Treinamentos"],
    ["alertas", "Alertas"],
    ["relatorios", "Relatórios"],
  ]) {
    await page.goto(`/${org}/${path}`);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
  }
});

test("balcão: busca de funcionário abre o carrinho", async ({ page }) => {
  await login(page);
  await page.goto(`/${org}/entregas/nova`);
  const search = page.getByLabel(
    "Buscar funcionário por nome, CPF ou matrícula",
  );
  await search.fill(process.env.E2E_EMPLOYEE_QUERY ?? "a");
  const first = page.getByRole("option").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(
    page.getByRole("heading", { name: "Itens da entrega" }),
  ).toBeVisible();
});

test("organização de outra empresa retorna não encontrado", async ({
  page,
}) => {
  await login(page);
  await page.goto("/organizacao-que-nao-e-minha/dashboard");
  await expect(
    page.getByText("Não encontrado").or(page.getByText("404")),
  ).toBeVisible();
});
