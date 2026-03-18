import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockAdminUsersApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("admin users", () => {
  test("lists users, filters them, and updates account status", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const updates: Array<{ userId: string; status: string }> = [];

    await mockAdminUsersApis(page, {
      items: [
        {
          id: USERS.admin.id,
          name: "Launch Admin",
          email: "1810365936@qq.com",
          role: "ADMIN",
          status: "active",
          createdAt: new Date("2026-03-16T08:00:00.000Z").toISOString(),
          inviteIssuedCount: 12,
          inviteUsedCount: 5,
          contentCount: 0,
          knowledgeBaseCount: 0,
          applicationCount: 0,
        },
        {
          id: "expert-1",
          name: "Expert User",
          email: "expert@example.com",
          role: "EXPERT",
          status: "suspended",
          company: "AI Lab",
          title: "Research Lead",
          createdAt: new Date("2026-03-15T08:00:00.000Z").toISOString(),
          lastLoginAt: new Date("2026-03-17T08:30:00.000Z").toISOString(),
          inviteIssuedCount: 2,
          inviteUsedCount: 1,
          contentCount: 4,
          knowledgeBaseCount: 3,
          applicationCount: 6,
        },
        {
          id: "enterprise-1",
          name: "Enterprise Lead",
          email: "enterprise@example.com",
          role: "ENTERPRISE_LEADER",
          status: "pending_identity_review",
          companyName: "AI Factory",
          phone: "+86 13800138000",
          createdAt: new Date("2026-03-14T08:00:00.000Z").toISOString(),
          inviteIssuedCount: 0,
          inviteUsedCount: 1,
          contentCount: 1,
          knowledgeBaseCount: 0,
          applicationCount: 2,
        },
      ],
      onUpdateUserStatus: (userId, status) => {
        updates.push({ userId, status });
      },
    });

    await page.goto("/admin/users");

    await expect(page.getByText("User Directory")).toBeVisible();
    await expect(page.getByTestId("admin-users-stat-total")).toContainText("3");
    await expect(page.getByTestId("admin-users-stat-active")).toContainText("1");
    await expect(page.getByTestId("admin-users-stat-pending")).toContainText("1");
    await expect(page.getByTestId("admin-users-stat-suspended")).toContainText("1");
    await expect(page.getByTestId("admin-users-results-count")).toHaveText(
      "3 results",
    );

    await page
      .getByPlaceholder("Search by name, email, company, or phone...")
      .fill("AI Factory");
    await expect(page.getByTestId("admin-users-row-enterprise-1")).toBeVisible();
    await expect(page.getByTestId("admin-users-row-expert-1")).not.toBeVisible();
    await expect(page.getByTestId("admin-users-results-count")).toHaveText(
      "1 results",
    );

    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByTestId("admin-users-role-filter").selectOption("EXPERT");
    await page.getByTestId("admin-users-status-filter").selectOption("suspended");

    await expect(page.getByTestId("admin-users-row-expert-1")).toBeVisible();
    await expect(page.getByTestId("admin-users-row-enterprise-1")).not.toBeVisible();

    await page.getByTestId("admin-users-toggle-status-expert-1").click();

    await expect.poll(() => updates).toEqual([
      { userId: "expert-1", status: "active" },
    ]);
    await expect(page.getByTestId("admin-users-results-count")).toHaveText(
      "0 results",
    );
  });
});
