import { expect, test, type Page } from "@playwright/test";
import { seedAuth, switchAuth, USERS } from "./helpers/auth";
import { installStrictApiMocking } from "./helpers/strictApi";

async function mockShellApis(page: Page, requests: string[]) {
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
}

test.describe("cross-module flows", () => {
  test("publishes a draft through admin review and exposes it on hub detail", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);

    const author = {
      id: USERS.learner.id,
      name: USERS.learner.name,
      email: USERS.learner.email,
      role: USERS.learner.role,
      avatar: USERS.learner.avatar || "",
      title: "Applied Researcher",
    };

    let contentId = "";
    let currentContent:
      | {
          id: string;
          title: string;
          description: string;
          type: string;
          status: string;
          authorId: string;
          createdAt: string;
          tags: string[];
          likes: number;
          views: number;
          visibility: string;
        }
      | null = null;

    await page.route("**/api/publish/mine", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentContent ? [currentContent] : []),
      });
    });

    await page.route("**/api/publish", async (route) => {
      requests.push(route.request().url());
      const body = route.request().postDataJSON() as Record<string, unknown>;
      contentId = "flow-content-1";
      currentContent = {
        id: contentId,
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        type: String(body.type ?? "PAPER"),
        status: "DRAFT",
        authorId: USERS.learner.id,
        createdAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
        tags: Array.isArray(body.tags)
          ? body.tags.map((tag) => String(tag))
          : [],
        likes: 0,
        views: 0,
        visibility: "ALL",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentContent),
      });
    });

    await page.route("**/api/publish/*/submit", async (route) => {
      requests.push(route.request().url());
      if (!currentContent) {
        throw new Error("submit called before content existed");
      }

      currentContent = {
        ...currentContent,
        status: "PENDING_REVIEW",
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentContent),
      });
    });

    await page.route("**/api/admin/dashboard", async (route) => {
      requests.push(route.request().url());
      const reviewItems =
        currentContent?.status === "PENDING_REVIEW"
          ? [{ ...currentContent, author }]
          : [];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            pendingReviewCount: reviewItems.length,
            pendingReportCount: 0,
          },
          reviewItems,
          reports: [],
        }),
      });
    });

    await page.route("**/api/admin/review/*/approve", async (route) => {
      requests.push(route.request().url());
      if (!currentContent) {
        throw new Error("approve called before content existed");
      }

      currentContent = {
        ...currentContent,
        status: "PUBLISHED",
        views: 18,
        likes: 6,
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/admin/reports", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/hub/*/detail", async (route) => {
      requests.push(route.request().url());
      if (!currentContent) {
        throw new Error("detail requested before content existed");
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: currentContent,
          author,
          relatedContents: [],
          viewerApplication: null,
        }),
      });
    });

    await page.goto("/publish");
    await page.getByTestId("publish-new-content-btn").click();
    await page
      .getByPlaceholder("Enter content title")
      .fill("Flow Regression Paper");
    await page
      .getByPlaceholder("Write your content here...")
      .fill("This submission must survive the review pipeline.");
    await page.getByPlaceholder(/e\.g\., AI/i).fill("AI,Flow");
    await page.getByTestId("publish-submit-review-btn").click();

    await expect.poll(() => currentContent?.status).toBe("PENDING_REVIEW");
    await expect(
      page
        .getByTestId("publish-item-title")
        .filter({ hasText: "Flow Regression Paper" }),
    ).toBeVisible();

    await switchAuth(page, USERS.admin);
    await page.goto("/admin/review");

    await expect(
      page.getByRole("heading", { name: "Flow Regression Paper" }),
    ).toBeVisible();
    await expect(page.getByText("Learner One")).toBeVisible();
    await page.getByTestId(`review-approve-${contentId}`).click();

    await expect.poll(() => currentContent?.status).toBe("PUBLISHED");
    await expect(
      page.getByRole("heading", { name: "Flow Regression Paper" }),
    ).not.toBeVisible();

    await switchAuth(page, USERS.expert);
    await page.goto(`/hub/paper/${contentId}`);

    await expect(page.getByText("Flow Regression Paper")).toBeVisible();
    await expect(page.getByText("Applied Researcher")).toBeVisible();
    await expect(
      page.getByText("This submission must survive the review pipeline."),
    ).toBeVisible();

    expect(
      requests.some((url) => url.includes(`/api/hub/${contentId}/detail`)),
    ).toBeTruthy();
    expect(requests.some((url) => url.includes("/api/users/"))).toBeFalsy();
  });

  test("propagates learner applications to the owner dashboard and updates state after approval", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);

    const project = {
      id: "project-flow-1",
      title: "Expert Collaboration Sprint",
      description: "Join an expert-owned project and validate application state.",
      type: "PROJECT",
      status: "PUBLISHED",
      authorId: USERS.expert.id,
      createdAt: new Date("2026-03-14T08:00:00.000Z").toISOString(),
      tags: ["Research"],
      likes: 2,
      views: 21,
      visibility: "ALL",
    };

    const applications: Array<{
      id: string;
      applicantId: string;
      targetType: string;
      targetId: string;
      message?: string;
      status: string;
      createdAt: string;
    }> = [];

    await page.route("**/api/learner/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            publishedContentCount: 0,
            availableContentCount: 1,
            pendingReviewCount: 0,
            applicationCount: applications.filter(
              (item) => item.applicantId === USERS.learner.id,
            ).length,
          },
          learningResources: [],
          projectOpportunities: [project],
          recommendedContents: [],
          myContents: [],
          applications,
        }),
      });
    });

    await page.route("**/api/applications", async (route) => {
      requests.push(route.request().url());
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const nextApplication = {
        id: "flow-application-1",
        applicantId: USERS.learner.id,
        targetType: "PROJECT",
        targetId: String(body.targetId ?? project.id),
        message:
          typeof body.message === "string" ? body.message : undefined,
        status: "SUBMITTED",
        createdAt: new Date("2026-03-15T11:00:00.000Z").toISOString(),
      };
      applications.splice(0, applications.length, nextApplication);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(nextApplication),
      });
    });

    await page.route("**/api/expert/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            totalContentCount: 1,
            totalViews: project.views,
            totalLikes: project.likes,
            pendingApplicantCount: applications.filter(
              (item) => item.status === "SUBMITTED",
            ).length,
          },
          myContents: [project],
          collaborationOpportunities: [],
          inboundApplications: applications.map((item) => ({
            ...item,
            applicant: {
              id: USERS.learner.id,
              name: USERS.learner.name,
              email: USERS.learner.email,
              role: USERS.learner.role,
              avatar: USERS.learner.avatar || "",
            },
            targetContentTitle: project.title,
          })),
          enterpriseConnections: [],
        }),
      });
    });

    await page.route("**/api/applications/*", async (route) => {
      requests.push(route.request().url());
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const nextStatus = String(body.status ?? "").toUpperCase();
      if (applications[0]) {
        applications[0].status = nextStatus;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/app/learner");

    await expect(page.getByText("Expert Collaboration Sprint")).toBeVisible();
    await page.getByTestId("learner-apply-project-flow-1").click();
    await page
      .getByTestId("learner-apply-message-project-flow-1")
      .fill("I can support the evaluation and writing workstream.");
    await page
      .getByTestId("learner-submit-application-project-flow-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("SUBMITTED");
    await expect(page.getByTestId("learner-stat-applications")).toHaveText("1");
    await expect(page.getByText("Applied", { exact: true })).toBeVisible();

    await switchAuth(page, USERS.expert);
    await page.goto("/app/expert");

    await expect(page.getByText("Learner One")).toBeVisible();
    await expect(
      page.getByRole("link", { name: project.title }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Approve$/ }).click();

    await expect.poll(() => applications[0]?.status).toBe("ACCEPTED");
    await expect(
      page.getByRole("button", { name: /^Approve$/ }),
    ).not.toBeVisible();

    await switchAuth(page, USERS.learner);
    await page.goto("/app/learner");

    await expect(page.getByTestId("learner-stat-applications")).toHaveText("1");
    await expect(page.getByText("Applied", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("learner-apply-project-flow-1"),
    ).not.toBeVisible();

    expect(
      requests.filter((url) => url.includes("/api/learner/dashboard")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      requests.some((url) => url.includes("/api/expert/dashboard")),
    ).toBeTruthy();
  });
});
