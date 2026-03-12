import { expect, test } from "@playwright/test";
import { USERS } from "./helpers/auth";
import { mockInviteApis, mockLoginApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("login", () => {
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

  test("unlocks register form after verifying a sample invite", async ({
    page,
  }) => {
    await installStrictApiMocking(page);
    await mockInviteApis(page);

    await page.goto("/login?tab=register");

    await page.getByTestId("login-sample-learner").click();

    await expect(page.getByTestId("register-invite-verified")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toHaveValue("");
  });
});
