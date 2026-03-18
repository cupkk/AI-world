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
              id: "need-2",
              title: "Adjacent Delivery Need",
              description: "Need a stable governance handoff.",
              type: "PROJECT",
              contentDomain: "ENTERPRISE_NEED",
              status: "PUBLISHED",
              authorId: "author-2",
              createdAt: new Date("2026-03-13T10:00:00.000Z").toISOString(),
              tags: ["Policy"],
              likes: 1,
              views: 3,
              background: "Need a stable governance handoff.",
              goal: "Document the rollout path.",
            },
          ],
          viewerApplication: null,
          detailSections: [
            {
              kind: "SUMMARY",
              content: "A practical policy workflow.",
            },
          ],
          applicationTargetType: "PROJECT",
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

    await expect
      .poll(() => requests.some((url) => url.includes("/api/hub/hub-1/detail")))
      .toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Policy Sprint" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Research Lead")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("link", { name: /Adjacent Delivery Need/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId("hub-detail-related-domain-need-2"),
    ).toContainText("Enterprise Need");
    await expect(
      page.getByTestId("hub-detail-related-preview-need-2-background"),
    ).toContainText("Need a stable governance handoff.");

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

  test("submits enterprise need applications with the correct target type and renders structured sections", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    let applicationBody: Record<string, unknown> | null = null;
    let detailRequested = false;

    await page.route("**/api/hub/need-1/detail", async (route) => {
      detailRequested = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: {
            id: "need-1",
            title: "Evaluation Operations Need",
            description: "Need a repeatable evaluation workflow.",
            type: "PROJECT",
            contentDomain: "ENTERPRISE_NEED",
            status: "PUBLISHED",
            authorId: "enterprise-1",
            createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
            tags: ["EXPERT", "LEARNER"],
            likes: 0,
            views: 0,
            visibility: "ALL",
          },
          author: {
            id: "enterprise-1",
            name: "Enterprise One",
            email: "enterprise@example.com",
            role: "ENTERPRISE_LEADER",
            avatar: "",
            title: "AI Lead",
          },
          relatedContents: [],
          viewerApplication: null,
          detailSections: [
            {
              kind: "BACKGROUND",
              content: "Need a repeatable evaluation workflow.",
            },
            {
              kind: "GOAL",
              content: "Ship a shared rubric across teams.",
            },
            {
              kind: "DELIVERABLES",
              content: "Weekly report and benchmark checklist.",
            },
          ],
          applicationTargetType: "ENTERPRISE_NEED",
        }),
      });
    });

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

    await page.route("**/api/applications", async (route) => {
      applicationBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "app-need-1",
          applicantId: USERS.learner.id,
          targetType: "ENTERPRISE_NEED",
          targetId: "need-1",
          message: "I can help document the workflow.",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
        }),
      });
    });

    await page.goto("/hub/project/need-1");

    await expect.poll(() => detailRequested).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Background" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Goal" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Deliverables" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Apply Now" }).click();
    await page
      .getByPlaceholder("Your message (optional)")
      .fill("I can help document the workflow.");
    await page.getByRole("button", { name: "Submit Application" }).click();

    expect(applicationBody).toMatchObject({
      targetType: "enterprise_need",
      targetId: "need-1",
    });
  });

  test("falls back to shared content-domain sections when detailSections are absent", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    await page.route("**/api/hub/research-1/detail", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: {
            id: "research-1",
            title: "Benchmark Research Sprint",
            description: "Design a benchmark rubric for frontier models.",
            type: "PROJECT",
            contentDomain: "RESEARCH_PROJECT",
            status: "PUBLISHED",
            authorId: "expert-1",
            createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
            tags: ["Benchmark"],
            likes: 3,
            views: 11,
            neededSupport: "Need help with evaluator tooling and test datasets.",
          },
          author: {
            id: "expert-1",
            name: "Expert One",
            email: "expert@example.com",
            role: "EXPERT",
            avatar: "",
            title: "Research Lead",
          },
          relatedContents: [],
          viewerApplication: null,
          detailSections: [],
          applicationTargetType: "RESEARCH_PROJECT",
        }),
      });
    });

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

    await page.goto("/hub/project/research-1");

    await expect(
      page.getByRole("heading", { name: "Summary" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Design a benchmark rubric for frontier models."),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Needed Support" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Need help with evaluator tooling and test datasets."),
    ).toBeVisible({ timeout: 10000 });
  });
});
