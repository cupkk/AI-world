import { expect, type Page } from "@playwright/test";

export async function liveLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

export async function expectPostLogin(page: Page) {
  await expect(page).toHaveURL(/\/(hub|onboarding|app|admin\/review)(?:\/|$)/);
}
