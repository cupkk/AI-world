import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("profile", () => {
  test("uses the aggregated profile page API without fetching the hub list", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];

    await page.route("**/api/profiles/user-1/page", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            name: "Research Lead",
            email: "lead@example.com",
            role: "EXPERT",
            avatar: "",
            bio: "Building practical AI policy workflows.",
            title: "Policy expert",
            company: "AI World Lab",
            location: "Singapore",
            whatImDoing: "Running evaluation pilots.",
            whatICanProvide: "Research design and reviews.",
            whatImLookingFor: "Implementation partners.",
          },
          contents: [
            {
              id: "hub-1",
              title: "Policy Sprint",
              description: "A practical policy workflow.",
              type: "PROJECT",
              status: "PUBLISHED",
              authorId: "user-1",
              createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
              tags: ["Policy"],
              likes: 4,
              views: 9,
            },
          ],
          summary: {
            publishedContentCount: 1,
            totalViews: 9,
            totalLikes: 4,
            featuredTypes: ["PROJECT"],
          },
        }),
      });
    });

    await page.route("**/api/messages/conversations", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/messages/requests", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/u/user-1");

    await expect(page.getByText("Research Lead")).toBeVisible();
    await expect(page.getByText("Policy Sprint")).toBeVisible();
    await expect(page.getByText("Running evaluation pilots.")).toBeVisible();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
    await expect(page.getByText("Views", { exact: true })).toBeVisible();
    await expect(page.getByText("Likes", { exact: true })).toBeVisible();
    await expect(page.getByText("1", { exact: true })).toBeVisible();
    await expect(page.getByText("9", { exact: true })).toBeVisible();
    await expect(page.getByText("4", { exact: true })).toBeVisible();

    expect(
      requests.some((url) => url.includes("/api/profiles/user-1/page")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes("/api/hub")),
    ).toBeFalsy();
    expect(
      requests.some(
        (url) =>
          url.includes("/api/profiles/user-1") &&
          !url.includes("/api/profiles/user-1/page"),
      ),
    ).toBeFalsy();
  });
});
