import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockProtectedRouteApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("route permissions", () => {
  test("redirects unauthenticated visitors to login", async ({ page }) => {
    await installStrictApiMocking(page);
    await page.goto("/hub");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("redirects non-admin users away from the review dashboard", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);
    await mockProtectedRouteApis(page);

    await page.goto("/admin/review");
    await expect(page).toHaveURL(/\/app\/learner$/);
  });
});
