import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockAdminHubApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("admin hub", () => {
  test("updates hub item metadata through the admin hub API", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const updates: Array<{ contentId: string; body: Record<string, unknown> }> =
      [];

    await mockAdminHubApis(page, {
      items: [
        {
          id: "hub-1",
          title: "Published Hub Item",
          description: "Already live",
          type: "PAPER",
          status: "PUBLISHED",
          authorId: "author-1",
          createdAt: new Date("2026-03-13T10:00:00.000Z").toISOString(),
          tags: ["AI"],
          likes: 3,
          views: 8,
          author: {
            id: "author-1",
            name: "Author One",
            email: "author@example.com",
            role: "LEARNER",
            avatar: "",
          },
        },
      ],
      onUpdateHubItem: (contentId, body) => {
        updates.push({ contentId, body });
      },
    });

    await page.goto("/admin/hub");
    await expect(page.getByText("Published Hub Item")).toBeVisible();
    await expect(page.getByText("Author One")).toBeVisible();

    await page.getByTestId("admin-hub-edit-hub-1").click();
    await page
      .getByTestId("admin-hub-edit-title-hub-1")
      .fill("Updated Hub Item");
    await page
      .getByTestId("admin-hub-edit-description-hub-1")
      .fill("Updated summary for admins");
    await page.getByTestId("admin-hub-save-hub-1").click();

    await expect.poll(() => updates.length).toBe(1);
    expect(updates[0]).toEqual({
      contentId: "hub-1",
      body: {
        title: "Updated Hub Item",
        description: "Updated summary for admins",
      },
    });

    await expect(page.getByText("Updated Hub Item")).toBeVisible();

    await page.getByTestId("admin-hub-edit-hub-1").click();
    await expect(
      page.getByTestId("admin-hub-edit-description-hub-1"),
    ).toHaveValue("Updated summary for admins");
  });

  test("moves published content back to draft and refreshes admin stats", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const updates: Array<{ contentId: string; body: Record<string, unknown> }> =
      [];

    await mockAdminHubApis(page, {
      items: [
        {
          id: "hub-2",
          title: "Live Enterprise Project",
          description: "Currently published",
          type: "PROJECT",
          status: "PUBLISHED",
          authorId: USERS.enterprise.id,
          createdAt: new Date("2026-03-13T12:00:00.000Z").toISOString(),
          tags: ["Enterprise"],
          likes: 6,
          views: 24,
          author: {
            id: USERS.enterprise.id,
            name: USERS.enterprise.name,
            email: USERS.enterprise.email,
            role: USERS.enterprise.role,
            avatar: "",
          },
        },
      ],
      onUpdateHubItem: (contentId, body) => {
        updates.push({ contentId, body });
      },
    });

    await page.goto("/admin/hub");
    await expect(
      page.getByTestId("admin-hub-stat-published").locator("p").nth(1),
    ).toHaveText("1");
    await expect(
      page.getByTestId("admin-hub-stat-draft").locator("p").nth(1),
    ).toHaveText("0");

    await page.getByTestId("admin-hub-unpublish-hub-2").click();

    await expect.poll(() => updates.length).toBe(1);
    expect(updates[0]).toEqual({
      contentId: "hub-2",
      body: { status: "draft" },
    });

    await expect(
      page.getByTestId("admin-hub-stat-published").locator("p").nth(1),
    ).toHaveText("0");
    await expect(
      page.getByTestId("admin-hub-stat-draft").locator("p").nth(1),
    ).toHaveText("1");
  });

  test("filters through the aggregated admin content API and batch approves visible items", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const updates: Array<{ contentId: string; body: Record<string, unknown> }> =
      [];

    await mockAdminHubApis(page, {
      items: [
        {
          id: "hub-3",
          title: "Policy Radar",
          description: "Needs approval",
          type: "POLICY",
          status: "PENDING_REVIEW",
          authorId: "author-3",
          createdAt: new Date("2026-03-13T12:00:00.000Z").toISOString(),
          tags: ["Policy"],
          likes: 1,
          views: 2,
          author: {
            id: "author-3",
            name: "Policy Analyst",
            email: "policy@example.com",
            role: "LEARNER",
            avatar: "",
          },
        },
        {
          id: "hub-4",
          title: "Policy Workflow",
          description: "Also pending",
          type: "POLICY",
          status: "PENDING_REVIEW",
          authorId: "author-4",
          createdAt: new Date("2026-03-13T13:00:00.000Z").toISOString(),
          tags: ["Policy"],
          likes: 0,
          views: 1,
          author: {
            id: "author-4",
            name: "Workflow Expert",
            email: "workflow@example.com",
            role: "EXPERT",
            avatar: "",
          },
        },
        {
          id: "hub-5",
          title: "Tooling Memo",
          description: "Different type",
          type: "TOOL",
          status: "PUBLISHED",
          authorId: "author-5",
          createdAt: new Date("2026-03-13T14:00:00.000Z").toISOString(),
          tags: ["Tool"],
          likes: 4,
          views: 9,
          author: {
            id: "author-5",
            name: "Tool Builder",
            email: "tool@example.com",
            role: "LEARNER",
            avatar: "",
          },
        },
      ],
      onUpdateHubItem: (contentId, body) => {
        updates.push({ contentId, body });
      },
    });

    await page.goto("/admin/hub");
    await page.getByTestId("admin-hub-stat-pending_review").click();
    await page.locator("select").selectOption("POLICY");
    await page.getByPlaceholder("Search by title, author, or tags...").fill("Policy");

    await expect(page.getByText("Policy Radar")).toBeVisible();
    await expect(page.getByText("Policy Workflow")).toBeVisible();
    await expect(page.getByText("Tooling Memo")).not.toBeVisible();
    await expect(page.getByTestId("admin-hub-results-count")).toHaveText("2 results");
    await expect(
      page.getByTestId("admin-hub-stat-pending_review").locator("p").nth(1),
    ).toHaveText("2");

    await page.getByTestId("admin-hub-select-all").click();
    await page.getByTestId("admin-hub-bulk-approve").click();

    await expect.poll(() => updates.length).toBe(2);
    expect(updates).toEqual([
      { contentId: "hub-3", body: { status: "published" } },
      { contentId: "hub-4", body: { status: "published" } },
    ]);

    await expect(page.getByTestId("admin-hub-results-count")).toHaveText("0 results");
    await expect(
      page.getByTestId("admin-hub-stat-pending_review").locator("p").nth(1),
    ).toHaveText("0");
  });
});
