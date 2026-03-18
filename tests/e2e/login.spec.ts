import { expect, test } from "@playwright/test";
import { USERS } from "./helpers/auth";
import { mockInviteApis, mockLoginApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("login", () => {
  test("defaults to Chinese and persists an explicit English switch", async ({
    page,
  }) => {
    await installStrictApiMocking(page);

    await page.goto("/login");
    await expect(page.getByText("加入全球最先进的 AI 社区").first()).toBeVisible();

    await page.getByTestId("login-language-en").click();
    await expect(
      page.getByText("Join the world's most advanced AI community").first(),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByText("Join the world's most advanced AI community").first(),
    ).toBeVisible();
  });

  test("persists auth state after a successful login", async ({ page }) => {
    await installStrictApiMocking(page);
    await mockLoginApis(page, USERS.learner);

    await page.goto("/login");
    await page.locator('input[type="email"]').fill("learner@example.com");
    await page.locator('input[type="password"]').fill("Password123!");
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/app(?:\/learner)?$/);

    const authRaw = await page.evaluate(() =>
      localStorage.getItem("ai-world-auth"),
    );
    expect(authRaw).toBeTruthy();

    const authState = JSON.parse(authRaw as string);
    expect(authState.state.isAuthenticated).toBe(true);
    expect(authState.state.user.role).toBe("LEARNER");
  });

  test("unlocks register form after verifying a manually entered invite", async ({
    page,
  }) => {
    await installStrictApiMocking(page);
    await mockInviteApis(page);

    await page.goto("/login?tab=register");

    await page
      .getByTestId("register-invite-input")
      .fill("AIWORLD-LEARNER-2026");
    await page.getByTestId("register-invite-verify").click();

    await expect(page.getByTestId("register-invite-verified")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toHaveValue("");
  });

  test("redirects legacy invite links to the register flow", async ({ page }) => {
    await installStrictApiMocking(page);

    await page.goto("/invite");

    await expect(page).toHaveURL(/\/login\?tab=register$/);
    await expect(page.getByTestId("register-invite-input")).toBeVisible();
  });
});
