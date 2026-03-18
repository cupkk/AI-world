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
            title: "Starter Workflow",
            description: "Deliver a mentor-ready workbook",
            type: "PROJECT",
            contentDomain: "ENTERPRISE_NEED",
            status: "PUBLISHED",
            authorId: USERS.expert.id,
            createdAt: new Date("2026-03-14T08:00:00.000Z").toISOString(),
            tags: ["AI"],
            likes: 3,
            views: 12,
            background: "Learn the AI-world workflow through a guided rollout",
            goal: "Build your first structured delivery plan",
          },
        ],
        projectOpportunities: [
          {
            id: "project-1",
            title: "Open learner project",
            description: "Join this project to build an applied AI case study.",
            type: "PROJECT",
            contentDomain: "ENTERPRISE_NEED",
            status: "PUBLISHED",
            authorId: USERS.enterprise.id,
            createdAt: new Date("2026-03-14T09:00:00.000Z").toISOString(),
            tags: ["Project"],
            likes: 0,
            views: 9,
            background: "Need a structured rollout and validation plan.",
            goal: "Ship a first internal AI case study with measurable results.",
            visibility: "ALL",
          },
        ],
        recommendedContents: [
          {
            id: "recommended-1",
            title: "Prompt Engineering Toolkit",
            description: "A practical toolkit",
            type: "PROJECT",
            contentDomain: "RESEARCH_PROJECT",
            status: "PUBLISHED",
            authorId: USERS.expert.id,
            createdAt: new Date("2026-03-13T12:00:00.000Z").toISOString(),
            tags: ["Prompting", "Toolkit"],
            likes: 5,
            views: 30,
            neededSupport: "Need help packaging the toolkit for new learners.",
          },
        ],
        myContents: [
          {
            id: "submission-1",
            title: "My Pending Submission",
            description: "Waiting for review",
            type: "PAPER",
            contentDomain: "HUB_ITEM",
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

    await expect(page.getByText("Starter Workflow")).toBeVisible();
    await expect(page.getByText("Project Opportunities")).toBeVisible();
    await expect(
      page.getByTestId("learner-learning-preview-resource-1"),
    ).toContainText("Learn the AI-world workflow through a guided rollout");
    await expect(page.getByText("Open learner project")).toBeVisible();
    await expect(page.getByText("Prompt Engineering Toolkit")).toBeVisible();
    await expect(page.getByText("My Pending Submission")).toBeVisible();
    await expect(
      page.getByTestId("learner-content-domain-submission-1"),
    ).toContainText("Hub Content");
    await expect(
      page.getByTestId("learner-content-preview-submission-1-summary"),
    ).toContainText("Waiting for review");
    await expect(page.getByTestId("learner-opportunity-domain-project-1")).toContainText("Enterprise Need");
    await expect(
      page.getByTestId("learner-opportunity-preview-project-1-background"),
    ).toContainText("Need a structured rollout and validation plan.");
    await expect(page.getByTestId("learner-recommended-domain-recommended-1")).toContainText("Research Project");
    await expect(
      page.getByTestId("learner-recommended-preview-recommended-1-summary"),
    ).toContainText("A practical toolkit");

    await page.getByTestId("learner-apply-project-1").click();
    await page
      .getByTestId("learner-apply-message-project-1")
      .fill("I can contribute 6 hours this week.");
    await page.getByTestId("learner-submit-application-project-1").click();

    await expect.poll(() => submittedApplications.length).toBe(1);
    expect(submittedApplications[0]).toEqual({
      targetType: "enterprise_need",
      targetId: "project-1",
      message: "I can contribute 6 hours this week.",
    });

    await expect(page.getByTestId("learner-stat-applications")).toHaveText("1");
    await expect(page.getByText("Applied", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("learner-application-target-application-created-1"),
    ).toHaveText("Open learner project");
    await expect(
      page.getByTestId("learner-application-domain-application-created-1"),
    ).toContainText("Enterprise Need");
  });

  test("shows target content status on learner application cards", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    await mockLearnerDashboardApis(page, {
      dashboard: {
        stats: {
          publishedContentCount: 0,
          availableContentCount: 0,
          pendingReviewCount: 0,
          applicationCount: 1,
        },
        learningResources: [],
        projectOpportunities: [],
        recommendedContents: [],
        myContents: [],
        applications: [
          {
            id: "application-rejected-target-1",
            applicantId: USERS.learner.id,
            targetType: "ENTERPRISE_NEED",
            targetId: "need-rejected-1",
            message: "Please let me know if it reopens.",
            status: "SUBMITTED",
            createdAt: new Date("2026-03-15T09:00:00.000Z").toISOString(),
            targetContentTitle: "Governance Closed Need",
            target: {
              id: "need-rejected-1",
              targetType: "ENTERPRISE_NEED",
              contentType: "PROJECT",
              contentDomain: "ENTERPRISE_NEED",
              title: "Governance Closed Need",
              status: "REJECTED",
              ownerId: USERS.enterprise.id,
            },
          },
        ],
      },
    });

    await page.goto("/app/learner");

    await expect(
      page.getByTestId(
        "learner-application-target-status-application-rejected-target-1",
      ),
    ).toContainText("Rejected");
  });

  test("shows owner suspension state on learner application cards", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    await mockLearnerDashboardApis(page, {
      dashboard: {
        stats: {
          publishedContentCount: 0,
          availableContentCount: 0,
          pendingReviewCount: 0,
          applicationCount: 1,
        },
        learningResources: [],
        projectOpportunities: [],
        recommendedContents: [],
        myContents: [],
        applications: [
          {
            id: "application-owner-suspended-1",
            applicantId: USERS.learner.id,
            targetType: "ENTERPRISE_NEED",
            targetId: "need-owner-suspended-1",
            message: "Checking if this reopens later.",
            status: "SUBMITTED",
            createdAt: new Date("2026-03-15T09:00:00.000Z").toISOString(),
            targetContentTitle: "Owner Suspended Need",
            target: {
              id: "need-owner-suspended-1",
              targetType: "ENTERPRISE_NEED",
              contentType: "PROJECT",
              contentDomain: "ENTERPRISE_NEED",
              title: "Owner Suspended Need",
              status: "PUBLISHED",
              ownerId: USERS.enterprise.id,
            },
            owner: {
              id: USERS.enterprise.id,
              name: USERS.enterprise.name,
              email: USERS.enterprise.email,
              role: USERS.enterprise.role,
              avatar: USERS.enterprise.avatar || "",
              status: "suspended",
            },
          },
        ],
      },
    });

    await page.goto("/app/learner");

    await expect(
      page.getByTestId(
        "learner-application-owner-status-application-owner-suspended-1",
      ),
    ).toContainText("Owner suspended");
  });
});
