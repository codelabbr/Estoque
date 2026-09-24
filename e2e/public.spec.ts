import { expect, test } from "@playwright/test";

test("rota protegida redireciona para o login preservando o destino", async ({
  page,
}) => {
  await page.goto("/qualquer-empresa/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fqualquer-empresa%2Fdashboard/);
});

test("link de assinatura inválido mostra mensagem amigável", async ({
  page,
}) => {
  await page.goto("/assinar/token-que-nao-existe-1234567890");
  await expect(
    page.getByRole("heading", { name: "Não foi possível abrir este link" }),
  ).toBeVisible();
  await expect(page.getByText("Link de assinatura inválido.")).toBeVisible();
});

test("termos e privacidade são públicos e marcados como rascunho", async ({
  page,
}) => {
  for (const path of ["/termos", "/privacidade"]) {
    await page.goto(path);
    await expect(
      page.getByText("Rascunho — revisar com advogado antes de publicar."),
    ).toBeVisible();
  }
});

test("login mostra erro de validação sem sair da página", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Informe o e-mail")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
