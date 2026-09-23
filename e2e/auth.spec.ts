import { test, expect } from "@playwright/test";

test("página de login exibe o formulário", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
});

test("navega do login para o cadastro", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Criar conta grátis" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(
    page.getByRole("heading", { name: "Crie sua conta" }),
  ).toBeVisible();
});

test("layout de login é usável em viewport de celular (375px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta" }),
  ).toBeVisible();
});
