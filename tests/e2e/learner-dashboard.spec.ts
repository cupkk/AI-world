import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockLearnerDashboardApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("learner dashboard", () => {
  test("renders aggregated dashboard data and submits a project application", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const submittedApplications: Array<Record<string, unknown>> = [];

    await mockLearnerDashboardApis(page, {
      dashboard: {
        stats: {
          publishedContentCount: 1,
          availableContentCount: 8,
          pendingReviewCount: 1,
          applicationCount: 0,
        },
        learningResources: [
          {
            id: "resource-1",
            title: "Starter Paper",
            description: "Learn the AI-world workflow",
            type: "PAPER",
            status: "PUBLISHED",
            authorId: USERS.expert.id,
            createdAt: new Date("2026-03-14T08:00:00.000Z").toISOString(),
            tags: ["AI"],
            likes: 3,
            views: 12,
          },
        ],
        projectOpportunities: [
          {
            id: "project-1",
            title: "Open learner project",
            description: "Join this project to build an applied AI case study.",
            type: "PROJECT",
            status: "PUBLISHED",
            authorId: USERS.enterprise.id,
            createdAt: new Date("2026-03-14T09:00:00.000Z").toISOString(),
            tags: ["Project"],
            likes: 0,
            views: 9,
          },
        ],
        recommendedContents: [
          {
            id: "recommended-1",
            title: "Prompt Engineering Toolkit",
            description: "A practical toolkit",
            type: "TOOL",
            status: "PUBLISHED",
            authorId: USERS.expert.id,
            createdAt: new Date("2026-03-13T12:00:00.000Z").toISOString(),
            tags: ["Prompting", "Toolkit"],
            likes: 5,
            views: 30,
          },
        ],
        myContents: [
          {
            id: "submission-1",
            title: "My Pending Submission",
            description: "Waiting for review",
            type: "PAPER",
            status: "PENDING_REVIEW",
            authorId: USERS.learner.id,
            createdAt: new Date("2026-03-12T12:00:00.000Z").toISOString(),
            tags: ["Draft"],
            likes: 1,
            views: 4,
          },
        ],
        applications: [],
      },
      onSubmitApplication: (body) => {
        submittedApplications.push(body);
      },
    });

    await page.goto("/app/learner");

    await expect(page.getByTestId("learner-stat-published")).toHaveText("1");
    await expect(page.getByTestId("learner-stat-available")).toHaveText("8");
    await expect(page.getByTestId("learner-stat-pending")).toHaveText("1");
    await expect(page.getByTestId("learner-stat-applications")).toHaveText("0");

    await expect(page.getByText("Starter Paper")).toBeVisible();
    await expect(page.getByText("Open learner project")).toBeVisible();
    await expect(page.getByText("Prompt Engineering Toolkit")).toBeVisible();
    await expect(page.getByText("My Pending Submission")).toBeVisible();

    await page.getByTestId("learner-apply-project-1").click();
    await page
      .getByTestId("learner-apply-message-project-1")
      .fill("I can contribute 6 hours this week.");
    await page.getByTestId("learner-submit-application-project-1").click();

    await expect.poll(() => submittedApplications.length).toBe(1);
    expect(submittedApplications[0]).toEqual({
      targetType: "hub_project",
      targetId: "project-1",
      message: "I can contribute 6 hours this week.",
    });

    await expect(page.getByTestId("learner-stat-applications")).toHaveText("1");
    await expect(page.getByText("Applied", { exact: true })).toBeVisible();
  });
});
