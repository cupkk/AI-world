import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("hub", () => {
  test("queries the aggregated hub API and renders author summaries without user lookups", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const hubRequests: string[] = [];
    const items = [
      {
        id: "hub-1",
        title: "Policy Sprint",
        description: "A project about policy automation.",
        type: "PROJECT",
        status: "PUBLISHED",
        authorId: "author-1",
        createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
        tags: ["Policy", "Automation"],
        likes: 2,
        views: 8,
        author: {
          id: "author-1",
          name: "Research Lead",
          email: "lead@example.com",
          role: "EXPERT",
          avatar: "",
        },
      },
      {
        id: "hub-2",
        title: "Paper Digest",
        description: "A paper summary feed.",
        type: "PAPER",
        status: "PUBLISHED",
        authorId: "author-2",
        createdAt: new Date("2026-03-14T09:00:00.000Z").toISOString(),
        tags: ["Research"],
        likes: 1,
        views: 3,
        author: {
          id: "author-2",
          name: "Paper Curator",
          email: "paper@example.com",
          role: "LEARNER",
          avatar: "",
        },
      },
    ];

    await page.route("**/api/messages/conversations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/messages/requests", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/hub**", async (route) => {
      const url = new URL(route.request().url());
      hubRequests.push(url.search);

      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const type = (url.searchParams.get("type") ?? "").trim().toUpperCase();

      const filtered = items.filter((item) => {
        const matchesQuery =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.author.name.toLowerCase().includes(q);
        const matchesType = !type || item.type === type;
        return matchesQuery && matchesType;
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: filtered }),
      });
    });

    await page.goto("/hub");

    await expect(page.getByText("Policy Sprint")).toBeVisible();
    await expect(page.getByText("Research Lead")).toBeVisible();
    await expect(page.getByText("Paper Digest")).toBeVisible();

    await page
      .getByPlaceholder("Search papers, projects, tags...")
      .fill("Policy");

    await expect
      .poll(() => hubRequests.some((query) => query.includes("q=Policy")))
      .toBeTruthy();

    await page.getByRole("button", { name: "Project" }).click();

    await expect
      .poll(() =>
        hubRequests.some(
          (query) => query.includes("q=Policy") && query.includes("type=PROJECT"),
        ),
      )
      .toBeTruthy();

    await expect(page.getByText("Policy Sprint")).toBeVisible();
    await expect(page.getByText("Paper Digest")).not.toBeVisible();
  });
});
