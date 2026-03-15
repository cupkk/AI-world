import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("hub detail", () => {
  test("uses the aggregated detail API and avoids extra lookup requests", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];

    await page.route("**/api/hub/hub-1/detail", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: {
            id: "hub-1",
            title: "Policy Sprint",
            description: "A practical policy workflow.",
            type: "PROJECT",
            status: "PUBLISHED",
            authorId: "author-1",
            createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
            tags: ["Policy", "Automation"],
            likes: 4,
            views: 9,
          },
          author: {
            id: "author-1",
            name: "Research Lead",
            email: "lead@example.com",
            role: "EXPERT",
            avatar: "",
            title: "Policy expert",
          },
          relatedContents: [
            {
              id: "hub-2",
              title: "Adjacent Paper",
              description: "Related paper notes.",
              type: "PAPER",
              status: "PUBLISHED",
              authorId: "author-2",
              createdAt: new Date("2026-03-13T10:00:00.000Z").toISOString(),
              tags: ["Policy"],
              likes: 1,
              views: 3,
            },
          ],
          viewerApplication: null,
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

    await page.route("**/api/applications", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "app-1",
          applicantId: USERS.learner.id,
          targetType: "PROJECT",
          targetId: "hub-1",
          message: "I can support the evaluation workflow.",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
        }),
      });
    });

    await page.goto("/hub/project/hub-1");

    await expect(page.getByText("Policy Sprint")).toBeVisible();
    await expect(page.getByText("Research Lead")).toBeVisible();
    await expect(page.getByText("Adjacent Paper")).toBeVisible();

    await page.getByRole("button", { name: "Apply Now" }).click();
    await page
      .getByPlaceholder("Your message (optional)")
      .fill("I can support the evaluation workflow.");
    await page.getByRole("button", { name: "Submit Application" }).click();

    await expect(
      page.getByText("Application Submitted", { exact: true }),
    ).toBeVisible();

    expect(
      requests.some((url) => url.includes("/api/hub/hub-1/detail")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes("/api/users/")),
    ).toBeFalsy();
    expect(
      requests.some((url) => url.includes("/api/applications/outbox")),
    ).toBeFalsy();
    expect(
      requests.some(
        (url) =>
          /\/api\/hub(?:\?|$)/.test(url) && !url.includes("/api/hub/hub-1/detail"),
      ),
    ).toBeFalsy();
  });
});
