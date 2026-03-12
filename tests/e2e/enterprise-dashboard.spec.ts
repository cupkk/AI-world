import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockEnterpriseDashboardApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("enterprise dashboard", () => {
  test("saves AI strategy through the enterprise profile API", async ({
    page,
  }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    const updateRequests: Array<Record<string, string>> = [];

    await mockEnterpriseDashboardApis(page, {
      enterpriseProfile: {
        userId: USERS.enterprise.id,
        aiStrategyText: "Current strategy",
        casesText: "Current focus",
        achievementsText: "Current needs",
      },
      onProfileUpdate: (body) => {
        updateRequests.push(body);
      },
    });

    await page.goto("/app/enterprise");
    await page.getByRole("button", { name: /^Edit$/ }).click();

    await page
      .getByTestId("enterprise-ai-strategy-input")
      .fill("Platform AI moat");
    await page
      .getByTestId("enterprise-current-focus-input")
      .fill("Agent integration");
    await page
      .getByTestId("enterprise-looking-for-input")
      .fill("Applied researchers");
    await page.getByTestId("enterprise-save-strategy-btn").click();

    await expect.poll(() => updateRequests.length).toBe(1);
    expect(updateRequests[0]).toEqual({
      aiStrategyText: "Platform AI moat",
      casesText: "Agent integration",
      achievementsText: "Applied researchers",
    });

    await expect(page.getByText("Platform AI moat")).toBeVisible();
    await expect(page.getByText("Agent integration")).toBeVisible();
    await expect(page.getByText("Applied researchers")).toBeVisible();
  });
});
