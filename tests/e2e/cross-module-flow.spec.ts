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

async function mockAdminAuditLogApis(page: Page, requests: string[]) {
  await page.route("**/api/admin/audit-logs**", async (route) => {
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
    await mockAdminAuditLogApis(page, requests);

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

    await page.route("**/api/applications/audit", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
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

  test("re-submits a rejected draft and publishes the approved revision", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

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
          contentDomain: string;
          authorId: string;
          createdAt: string;
          tags: string[];
          likes: number;
          views: number;
          visibility: string;
          rejectReason?: string | null;
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
      contentId = "flow-content-revision-1";
      currentContent = {
        id: contentId,
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        type: String(body.type ?? "PAPER"),
        status: "DRAFT",
        contentDomain: "HUB_ITEM",
        authorId: USERS.learner.id,
        createdAt: new Date("2026-03-15T12:00:00.000Z").toISOString(),
        tags: Array.isArray(body.tags)
          ? body.tags.map((tag) => String(tag))
          : [],
        likes: 0,
        views: 0,
        visibility: "ALL",
        rejectReason: null,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentContent),
      });
    });

    await page.route("**/api/publish/*", async (route) => {
      requests.push(route.request().url());
      if (!currentContent) {
        await route.fallback();
        return;
      }

      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentContent),
        });
        return;
      }

      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON() as Record<string, unknown>;
      currentContent = {
        ...currentContent,
        title: String(body.title ?? currentContent.title),
        description: String(body.description ?? currentContent.description),
        type:
          typeof body.type === "string"
            ? body.type.toUpperCase()
            : currentContent.type,
        tags: Array.isArray(body.tags)
          ? body.tags.map((tag) => String(tag))
          : currentContent.tags,
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentContent),
      });
    });

    await page.route("**/api/publish/*/draft", async (route) => {
      requests.push(route.request().url());
      if (!currentContent) {
        throw new Error("draft save called before content existed");
      }

      currentContent = {
        ...currentContent,
        status: "DRAFT",
        rejectReason: null,
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
        rejectReason: null,
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

    await page.route("**/api/applications/audit", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/admin/review/*/reject", async (route) => {
      requests.push(route.request().url());
      if (!currentContent) {
        throw new Error("reject called before content existed");
      }

      const body = route.request().postDataJSON() as Record<string, unknown>;
      currentContent = {
        ...currentContent,
        status: "REJECTED",
        rejectReason: String(body.reason ?? "Needs a stronger revision."),
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
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
        likes: 4,
        views: 22,
        rejectReason: null,
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

    await page.route("**/api/hub/*", async (route) => {
      requests.push(route.request().url());
      if (!currentContent) {
        throw new Error("content requested before it existed");
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentContent),
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
      .fill("Revision Flow Draft");
    await page
      .getByPlaceholder("Write your content here...")
      .fill("The first version will be rejected before the final approval.");
    await page.getByPlaceholder(/e\.g\., AI/i).fill("AI,Revision");
    await page.getByTestId("publish-submit-review-btn").click();

    await expect.poll(() => currentContent?.status).toBe("PENDING_REVIEW");

    await switchAuth(page, USERS.admin);
    await page.goto("/admin/review");

    await expect(
      page.getByRole("heading", { name: "Revision Flow Draft" }),
    ).toBeVisible();
    await page.getByTestId(`review-reject-${contentId}`).click();
    await page
      .getByTestId(`review-reject-reason-${contentId}`)
      .fill("Please add implementation detail and clarify the scope.");
    await page.getByTestId(`review-confirm-reject-${contentId}`).click();

    await expect.poll(() => currentContent?.status).toBe("REJECTED");
    await expect(
      page.getByRole("heading", { name: "Revision Flow Draft" }),
    ).not.toBeVisible();

    await switchAuth(page, USERS.learner);
    await page.goto(`/publish/${contentId}`);

    await expect(
      page.getByText("Please add implementation detail and clarify the scope."),
    ).toBeVisible();
    await page.getByTestId("publish-detail-edit-btn").click();
    await page
      .getByTestId("publish-detail-title-input")
      .fill("Revision Flow Draft v2");
    await page.getByTestId("publish-detail-save-btn").click();
    await expect(
      page.getByRole("heading", { name: "Revision Flow Draft v2" }),
    ).toBeVisible();

    await page.getByTestId("publish-detail-save-draft-btn").click();
    await expect.poll(() => currentContent?.status).toBe("DRAFT");
    await page.getByTestId("publish-detail-submit-btn").click();

    await expect.poll(() => currentContent?.status).toBe("PENDING_REVIEW");
    await expect(
      page.getByText("Please add implementation detail and clarify the scope."),
    ).not.toBeVisible();

    await switchAuth(page, USERS.admin);
    await page.goto("/admin/review");

    await expect(
      page.getByRole("heading", { name: "Revision Flow Draft v2" }),
    ).toBeVisible();
    await page.getByTestId(`review-approve-${contentId}`).click();

    await expect.poll(() => currentContent?.status).toBe("PUBLISHED");

    await switchAuth(page, USERS.expert);
    await page.goto(`/hub/paper/${contentId}`);

    await expect(page.getByText("Revision Flow Draft v2")).toBeVisible();
    await expect(
      page.getByText(
        "The first version will be rejected before the final approval.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Please add implementation detail and clarify the scope."),
    ).not.toBeVisible();

    expect(
      requests.some((url) => url.includes(`/api/publish/${contentId}/draft`)),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes(`/api/admin/review/${contentId}/reject`)),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes(`/api/admin/review/${contentId}/approve`)),
    ).toBeTruthy();
  });

  test("propagates learner applications to the owner dashboard and updates state after approval", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

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

  test("propagates learner applications to the enterprise owner dashboard and updates state after approval", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

    const enterpriseNeed = {
      id: "enterprise-need-flow-1",
      title: "Enterprise AI Rollout",
      description: "Partner with the enterprise team on an implementation sprint.",
      type: "PROJECT",
      status: "PUBLISHED",
      contentDomain: "ENTERPRISE_NEED",
      authorId: USERS.enterprise.id,
      createdAt: new Date("2026-03-15T09:00:00.000Z").toISOString(),
      tags: ["Enterprise", "Rollout"],
      likes: 1,
      views: 14,
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
      target?: {
        id: string;
        targetType: string;
        contentType: string;
        contentDomain: string;
        title: string;
        status: string;
        ownerId: string;
      };
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
          projectOpportunities: [enterpriseNeed],
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
        id: "enterprise-flow-application-1",
        applicantId: USERS.learner.id,
        targetType: "PROJECT",
        targetId: String(body.targetId ?? enterpriseNeed.id),
        message:
          typeof body.message === "string" ? body.message : undefined,
        status: "SUBMITTED",
        createdAt: new Date("2026-03-15T11:30:00.000Z").toISOString(),
        target: {
          id: enterpriseNeed.id,
          targetType: "PROJECT",
          contentType: enterpriseNeed.type,
          contentDomain: enterpriseNeed.contentDomain,
          title: enterpriseNeed.title,
          status: enterpriseNeed.status,
          ownerId: enterpriseNeed.authorId,
        },
      };
      applications.splice(0, applications.length, nextApplication);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(nextApplication),
      });
    });

    await page.route("**/api/enterprise/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            aiStrategy: "Operational AI platform",
            whatImDoing: "Rolling out internal copilots",
            whatImLookingFor: "Applied researchers and builders",
          },
          stats: {
            recommendedExpertsCount: 0,
            activeConversationsCount: 0,
            postedNeedsCount: 1,
            pendingInboundApplicationsCount: applications.filter(
              (item) => item.status === "SUBMITTED",
            ).length,
          },
          recommendedExperts: [],
          myContents: [enterpriseNeed],
          inboundApplications: applications.map((item) => ({
            ...item,
            applicant: {
              id: USERS.learner.id,
              name: USERS.learner.name,
              email: USERS.learner.email,
              role: USERS.learner.role,
              avatar: USERS.learner.avatar || "",
            },
            targetContentTitle: enterpriseNeed.title,
          })),
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

    await expect(page.getByText("Enterprise AI Rollout")).toBeVisible();
    await page.getByTestId("learner-apply-enterprise-need-flow-1").click();
    await page
      .getByTestId("learner-apply-message-enterprise-need-flow-1")
      .fill("I can help the enterprise team validate delivery workflows.");
    await page
      .getByTestId("learner-submit-application-enterprise-need-flow-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("SUBMITTED");
    await expect(page.getByTestId("learner-stat-applications")).toHaveText("1");
    await expect(page.getByText("Applied", { exact: true })).toBeVisible();

    await switchAuth(page, USERS.enterprise);
    await page.goto("/app/enterprise");

    await expect(page.getByText("Learner One")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Enterprise AI Rollout/i }).first(),
    ).toBeVisible();
    await page
      .getByTestId("enterprise-approve-enterprise-flow-application-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("ACCEPTED");
    await expect(
      page.getByTestId("enterprise-approve-enterprise-flow-application-1"),
    ).not.toBeVisible();

    await switchAuth(page, USERS.learner);
    await page.goto("/app/learner");

    await expect(page.getByTestId("learner-stat-applications")).toHaveText("1");
    await expect(page.getByText("Applied", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("learner-apply-enterprise-need-flow-1"),
    ).not.toBeVisible();

    expect(
      requests.filter((url) => url.includes("/api/learner/dashboard")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      requests.some((url) => url.includes("/api/enterprise/dashboard")),
    ).toBeTruthy();
  });

  test("propagates audit target rejection to expert and learner dashboards", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

    const project = {
      id: "audit-target-project-1",
      title: "Governance Review Project",
      description: "Audit linkage should close the loop across pages.",
      type: "PROJECT",
      contentDomain: "RESEARCH_PROJECT",
      status: "PUBLISHED",
      authorId: USERS.expert.id,
      createdAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
      tags: ["Governance", "Research"],
      likes: 2,
      views: 13,
      neededSupport: "Need support from validation contributors.",
      visibility: "ALL",
    };

    const application = {
      id: "audit-linked-application-1",
      applicantId: USERS.learner.id,
      targetType: "RESEARCH_PROJECT",
      targetId: project.id,
      message: "I can help validate the rollout.",
      status: "SUBMITTED",
      createdAt: new Date("2026-03-16T08:00:00.000Z").toISOString(),
      target: {
        id: project.id,
        targetType: "RESEARCH_PROJECT",
        contentType: project.type,
        contentDomain: project.contentDomain,
        title: project.title,
        status: project.status,
        ownerId: project.authorId,
      },
      targetContentTitle: project.title,
    };

    const buildAuditItem = () => ({
      ...application,
      ageInDays: 3,
      auditFlags:
        project.status === "PUBLISHED"
          ? ["STALE_SUBMITTED"]
          : ["TARGET_NOT_PUBLISHED"],
      applicant: {
        id: USERS.learner.id,
        name: USERS.learner.name,
        email: USERS.learner.email,
        role: USERS.learner.role,
        avatar: USERS.learner.avatar || "",
      },
      owner: {
        id: USERS.expert.id,
        name: USERS.expert.name,
        email: USERS.expert.email,
        role: USERS.expert.role,
        avatar: USERS.expert.avatar || "",
      },
      target: {
        ...application.target,
        status: project.status,
      },
      governanceState: project.status === "REJECTED" ? "REVIEWED" : "OPEN",
      latestGovernanceAction:
        project.status === "REJECTED"
          ? {
              action: "REJECT_TARGET_CONTENT",
              actorId: USERS.admin.id,
              actorName: USERS.admin.name,
              createdAt: new Date("2026-03-16T12:00:00.000Z").toISOString(),
              reason: "Target no longer passes governance review.",
            }
          : undefined,
      governanceTimeline:
        project.status === "REJECTED"
          ? [
              {
                action: "REJECT_TARGET_CONTENT",
                actorId: USERS.admin.id,
                actorName: USERS.admin.name,
                createdAt: new Date("2026-03-16T12:00:00.000Z").toISOString(),
                reason: "Target no longer passes governance review.",
              },
            ]
          : [],
    });

    await page.route("**/api/admin/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            pendingReviewCount: 0,
            pendingReportCount: 0,
          },
          reviewItems: [],
          reports: [],
        }),
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

    await page.route("**/api/applications/audit", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([buildAuditItem()]),
      });
    });

    await page.route("**/api/applications/audit/actions", async (route) => {
      requests.push(route.request().url());
      const body = route.request().postDataJSON() as {
        ids?: string[];
        action?: string;
      };

      if (
        body?.action === "REJECT_TARGET_CONTENT" &&
        Array.isArray(body.ids) &&
        body.ids.includes(application.id)
      ) {
        project.status = "REJECTED";
        application.target.status = "REJECTED";
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updatedIds: body?.ids ?? [] }),
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
            pendingApplicantCount: application.status === "SUBMITTED" ? 1 : 0,
          },
          myContents: [project],
          collaborationOpportunities: [],
          inboundApplications: [
            {
              ...application,
              applicant: {
                id: USERS.learner.id,
                name: USERS.learner.name,
                email: USERS.learner.email,
                role: USERS.learner.role,
                avatar: USERS.learner.avatar || "",
              },
              target: {
                ...application.target,
                status: project.status,
              },
            },
          ],
          enterpriseConnections: [],
        }),
      });
    });

    await page.route("**/api/learner/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            publishedContentCount: 0,
            availableContentCount: project.status === "PUBLISHED" ? 1 : 0,
            pendingReviewCount: 0,
            applicationCount: 1,
          },
          learningResources: [],
          projectOpportunities: project.status === "PUBLISHED" ? [project] : [],
          recommendedContents: [],
          myContents: [],
          applications: [
            {
              ...application,
              target: {
                ...application.target,
                status: project.status,
              },
              owner: {
                id: USERS.expert.id,
                name: USERS.expert.name,
                email: USERS.expert.email,
                role: USERS.expert.role,
                avatar: USERS.expert.avatar || "",
              },
            },
          ],
        }),
      });
    });

    await page.goto("/admin/review");

    await expect(
      page.getByTestId(`review-audit-row-${application.id}`),
    ).toBeVisible();
    await page
      .getByTestId(
        `review-audit-action-reject-target-content-${application.id}`,
      )
      .click();

    await expect(
      page
        .getByTestId(`review-audit-row-${application.id}`)
        .getByText("REJECTED"),
    ).toBeVisible();
    await expect(
      page.getByTestId(`review-audit-timeline-${application.id}-0`),
    ).toContainText("Reject target content");

    await switchAuth(page, USERS.expert);
    await page.goto("/app/expert");

    await expect(
      page.getByTestId(
        `expert-application-target-status-${application.id}`,
      ),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId(`expert-approve-${application.id}`),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(`expert-reject-${application.id}`),
    ).toHaveCount(0);

    await switchAuth(page, USERS.learner);
    await page.goto("/app/learner");

    await expect(
      page.getByTestId(
        `learner-application-target-status-${application.id}`,
      ),
    ).toContainText("Rejected");

    expect(
      requests.some((url) => url.includes("/api/applications/audit/actions")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes("/api/expert/dashboard")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes("/api/learner/dashboard")),
    ).toBeTruthy();
  });

  test("propagates audit applicant suspension to the expert owner dashboard", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

    const project = {
      id: "audit-suspend-applicant-project-1",
      title: "Applicant Governance Project",
      description: "Owner dashboard should reflect applicant suspension.",
      type: "PROJECT",
      contentDomain: "RESEARCH_PROJECT",
      status: "PUBLISHED",
      authorId: USERS.expert.id,
      createdAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
      tags: ["Governance"],
      likes: 1,
      views: 7,
      neededSupport: "Need evaluation support.",
      visibility: "ALL",
    };

    const applicant = {
      id: USERS.learner.id,
      name: USERS.learner.name,
      email: USERS.learner.email,
      role: USERS.learner.role,
      avatar: USERS.learner.avatar || "",
      status: "active",
    };

    const application = {
      id: "audit-suspend-applicant-1",
      applicantId: USERS.learner.id,
      targetType: "RESEARCH_PROJECT",
      targetId: project.id,
      message: "I can support the benchmark pass.",
      status: "SUBMITTED",
      createdAt: new Date("2026-03-16T08:00:00.000Z").toISOString(),
      target: {
        id: project.id,
        targetType: "RESEARCH_PROJECT",
        contentType: project.type,
        contentDomain: project.contentDomain,
        title: project.title,
        status: project.status,
        ownerId: project.authorId,
      },
      targetContentTitle: project.title,
    };

    const buildAuditItem = () => ({
      ...application,
      ageInDays: 2,
      auditFlags:
        applicant.status === "suspended"
          ? ["APPLICANT_SUSPENDED"]
          : ["STALE_SUBMITTED"],
      applicant: { ...applicant },
      owner: {
        id: USERS.expert.id,
        name: USERS.expert.name,
        email: USERS.expert.email,
        role: USERS.expert.role,
        avatar: USERS.expert.avatar || "",
      },
      target: {
        ...application.target,
        status: project.status,
      },
      governanceState: applicant.status === "suspended" ? "REVIEWED" : "OPEN",
      latestGovernanceAction:
        applicant.status === "suspended"
          ? {
              action: "SUSPEND_APPLICANT",
              actorId: USERS.admin.id,
              actorName: USERS.admin.name,
              createdAt: new Date("2026-03-16T12:00:00.000Z").toISOString(),
            }
          : undefined,
      governanceTimeline:
        applicant.status === "suspended"
          ? [
              {
                action: "SUSPEND_APPLICANT",
                actorId: USERS.admin.id,
                actorName: USERS.admin.name,
                createdAt: new Date("2026-03-16T12:00:00.000Z").toISOString(),
              },
            ]
          : [],
    });

    await page.route("**/api/admin/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            pendingReviewCount: 0,
            pendingReportCount: 0,
          },
          reviewItems: [],
          reports: [],
        }),
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

    await page.route("**/api/applications/audit", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([buildAuditItem()]),
      });
    });

    await page.route("**/api/applications/audit/actions", async (route) => {
      requests.push(route.request().url());
      const body = route.request().postDataJSON() as {
        ids?: string[];
        action?: string;
      };

      if (
        body?.action === "SUSPEND_APPLICANT" &&
        Array.isArray(body.ids) &&
        body.ids.includes(application.id)
      ) {
        applicant.status = "suspended";
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updatedIds: body?.ids ?? [] }),
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
            pendingApplicantCount: application.status === "SUBMITTED" ? 1 : 0,
          },
          myContents: [project],
          collaborationOpportunities: [],
          inboundApplications: [
            {
              ...application,
              applicant: { ...applicant },
              target: {
                ...application.target,
                status: project.status,
              },
            },
          ],
          enterpriseConnections: [],
        }),
      });
    });

    await page.goto("/admin/review");

    await expect(
      page.getByTestId(`review-audit-row-${application.id}`),
    ).toBeVisible();
    await page
      .getByTestId(`review-audit-action-suspend-applicant-${application.id}`)
      .click();

    await expect(
      page.getByTestId(`review-audit-row-${application.id}`),
    ).toContainText("Applicant suspended");
    await expect(
      page.getByTestId(`review-audit-timeline-${application.id}-0`),
    ).toContainText("Suspend applicant");

    await switchAuth(page, USERS.expert);
    await page.goto("/app/expert");

    await expect(
      page.getByTestId(
        `expert-application-applicant-status-${application.id}`,
      ),
    ).toContainText("Applicant suspended");
    await expect(
      page.getByTestId(`expert-approve-${application.id}`),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(`expert-reject-${application.id}`),
    ).toHaveCount(0);

    expect(
      requests.some((url) => url.includes("/api/applications/audit/actions")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes("/api/expert/dashboard")),
    ).toBeTruthy();
  });

  test("propagates audit owner suspension to the learner outbox", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

    const project = {
      id: "audit-suspend-owner-need-1",
      title: "Owner Governance Need",
      description: "Learner outbox should reflect owner suspension.",
      type: "PROJECT",
      contentDomain: "ENTERPRISE_NEED",
      status: "PUBLISHED",
      authorId: USERS.enterprise.id,
      createdAt: new Date("2026-03-15T11:00:00.000Z").toISOString(),
      tags: ["Governance", "Enterprise"],
      likes: 1,
      views: 9,
      background: "Need a governance-safe owner flow.",
      goal: "Validate owner suspension propagation.",
      visibility: "ALL",
    };

    const owner = {
      id: USERS.enterprise.id,
      name: USERS.enterprise.name,
      email: USERS.enterprise.email,
      role: USERS.enterprise.role,
      avatar: USERS.enterprise.avatar || "",
      status: "active",
    };

    const application = {
      id: "audit-suspend-owner-1",
      applicantId: USERS.learner.id,
      targetType: "ENTERPRISE_NEED",
      targetId: project.id,
      message: "Please keep me posted on governance changes.",
      status: "SUBMITTED",
      createdAt: new Date("2026-03-16T09:00:00.000Z").toISOString(),
      target: {
        id: project.id,
        targetType: "ENTERPRISE_NEED",
        contentType: project.type,
        contentDomain: project.contentDomain,
        title: project.title,
        status: project.status,
        ownerId: project.authorId,
      },
      targetContentTitle: project.title,
    };

    const buildAuditItem = () => ({
      ...application,
      ageInDays: 2,
      auditFlags:
        owner.status === "suspended"
          ? ["OWNER_SUSPENDED"]
          : ["STALE_SUBMITTED"],
      applicant: {
        id: USERS.learner.id,
        name: USERS.learner.name,
        email: USERS.learner.email,
        role: USERS.learner.role,
        avatar: USERS.learner.avatar || "",
      },
      owner: { ...owner },
      target: {
        ...application.target,
        status: project.status,
      },
      governanceState: owner.status === "suspended" ? "REVIEWED" : "OPEN",
      latestGovernanceAction:
        owner.status === "suspended"
          ? {
              action: "SUSPEND_OWNER",
              actorId: USERS.admin.id,
              actorName: USERS.admin.name,
              createdAt: new Date("2026-03-16T13:00:00.000Z").toISOString(),
            }
          : undefined,
      governanceTimeline:
        owner.status === "suspended"
          ? [
              {
                action: "SUSPEND_OWNER",
                actorId: USERS.admin.id,
                actorName: USERS.admin.name,
                createdAt: new Date("2026-03-16T13:00:00.000Z").toISOString(),
              },
            ]
          : [],
    });

    await page.route("**/api/admin/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            pendingReviewCount: 0,
            pendingReportCount: 0,
          },
          reviewItems: [],
          reports: [],
        }),
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

    await page.route("**/api/applications/audit", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([buildAuditItem()]),
      });
    });

    await page.route("**/api/applications/audit/actions", async (route) => {
      requests.push(route.request().url());
      const body = route.request().postDataJSON() as {
        ids?: string[];
        action?: string;
      };

      if (
        body?.action === "SUSPEND_OWNER" &&
        Array.isArray(body.ids) &&
        body.ids.includes(application.id)
      ) {
        owner.status = "suspended";
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updatedIds: body?.ids ?? [] }),
      });
    });

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
            applicationCount: 1,
          },
          learningResources: [],
          projectOpportunities: [project],
          recommendedContents: [],
          myContents: [],
          applications: [
            {
              ...application,
              target: {
                ...application.target,
                status: project.status,
              },
              owner: { ...owner },
            },
          ],
        }),
      });
    });

    await page.goto("/admin/review");

    await expect(
      page.getByTestId(`review-audit-row-${application.id}`),
    ).toBeVisible();
    await page
      .getByTestId(`review-audit-action-suspend-owner-${application.id}`)
      .click();

    await expect(
      page.getByTestId(`review-audit-row-${application.id}`),
    ).toContainText("Owner suspended");
    await expect(
      page.getByTestId(`review-audit-timeline-${application.id}-0`),
    ).toContainText("Suspend owner");

    await switchAuth(page, USERS.learner);
    await page.goto("/app/learner");

    await expect(
      page.getByTestId(`learner-application-owner-status-${application.id}`),
    ).toContainText("Owner suspended");

    expect(
      requests.some((url) => url.includes("/api/applications/audit/actions")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes("/api/learner/dashboard")),
    ).toBeTruthy();
  });

  test("propagates batch target rejection to expert and learner dashboards", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

    const projects = [
      {
        id: "audit-batch-project-1",
        title: "Batch Governance Project One",
        description: "First target in the batch governance flow.",
        type: "PROJECT",
        contentDomain: "RESEARCH_PROJECT",
        status: "PUBLISHED",
        authorId: USERS.expert.id,
        createdAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
        tags: ["Governance"],
        likes: 1,
        views: 6,
        neededSupport: "Need review help for the first batch target.",
        visibility: "ALL",
      },
      {
        id: "audit-batch-project-2",
        title: "Batch Governance Project Two",
        description: "Second target in the batch governance flow.",
        type: "PROJECT",
        contentDomain: "RESEARCH_PROJECT",
        status: "PUBLISHED",
        authorId: USERS.expert.id,
        createdAt: new Date("2026-03-15T11:00:00.000Z").toISOString(),
        tags: ["Governance"],
        likes: 2,
        views: 8,
        neededSupport: "Need evaluation help for the second batch target.",
        visibility: "ALL",
      },
    ];

    const applications = [
      {
        id: "audit-batch-application-1",
        applicantId: USERS.learner.id,
        targetType: "RESEARCH_PROJECT",
        targetId: projects[0].id,
        message: "I can support the first target.",
        status: "SUBMITTED",
        createdAt: new Date("2026-03-16T08:00:00.000Z").toISOString(),
        target: {
          id: projects[0].id,
          targetType: "RESEARCH_PROJECT",
          contentType: projects[0].type,
          contentDomain: projects[0].contentDomain,
          title: projects[0].title,
          status: projects[0].status,
          ownerId: projects[0].authorId,
        },
        targetContentTitle: projects[0].title,
      },
      {
        id: "audit-batch-application-2",
        applicantId: USERS.learner.id,
        targetType: "RESEARCH_PROJECT",
        targetId: projects[1].id,
        message: "I can support the second target.",
        status: "SUBMITTED",
        createdAt: new Date("2026-03-16T09:00:00.000Z").toISOString(),
        target: {
          id: projects[1].id,
          targetType: "RESEARCH_PROJECT",
          contentType: projects[1].type,
          contentDomain: projects[1].contentDomain,
          title: projects[1].title,
          status: projects[1].status,
          ownerId: projects[1].authorId,
        },
        targetContentTitle: projects[1].title,
      },
    ];

    let batchActionBody:
      | {
          ids?: string[];
          action?: string;
        }
      | null = null;

    const buildAuditItems = () =>
      applications.map((application) => ({
        ...application,
        ageInDays: 2,
        auditFlags:
          application.target.status === "PUBLISHED"
            ? ["STALE_SUBMITTED"]
            : ["TARGET_NOT_PUBLISHED"],
        applicant: {
          id: USERS.learner.id,
          name: USERS.learner.name,
          email: USERS.learner.email,
          role: USERS.learner.role,
          avatar: USERS.learner.avatar || "",
        },
        owner: {
          id: USERS.expert.id,
          name: USERS.expert.name,
          email: USERS.expert.email,
          role: USERS.expert.role,
          avatar: USERS.expert.avatar || "",
        },
        governanceState:
          application.target.status === "REJECTED" ? "REVIEWED" : "OPEN",
        latestGovernanceAction:
          application.target.status === "REJECTED"
            ? {
                action: "REJECT_TARGET_CONTENT",
                actorId: USERS.admin.id,
                actorName: USERS.admin.name,
                createdAt: new Date("2026-03-16T14:00:00.000Z").toISOString(),
                reason: "Batch governance rejected linked targets.",
              }
            : undefined,
        governanceTimeline:
          application.target.status === "REJECTED"
            ? [
                {
                  action: "REJECT_TARGET_CONTENT",
                  actorId: USERS.admin.id,
                  actorName: USERS.admin.name,
                  createdAt: new Date("2026-03-16T14:00:00.000Z").toISOString(),
                  reason: "Batch governance rejected linked targets.",
                },
              ]
            : [],
      }));

    await page.route("**/api/admin/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            pendingReviewCount: 0,
            pendingReportCount: 0,
          },
          reviewItems: [],
          reports: [],
        }),
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

    await page.route("**/api/applications/audit", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildAuditItems()),
      });
    });

    await page.route("**/api/applications/audit/actions", async (route) => {
      requests.push(route.request().url());
      const body = route.request().postDataJSON() as {
        ids?: string[];
        action?: string;
      };
      batchActionBody = body;

      if (
        body?.action === "REJECT_TARGET_CONTENT" &&
        Array.isArray(body.ids)
      ) {
        applications.forEach((application) => {
          if (!body.ids?.includes(application.id)) {
            return;
          }

          application.target.status = "REJECTED";
          const matchedProject = projects.find(
            (project) => project.id === application.targetId,
          );
          if (matchedProject) {
            matchedProject.status = "REJECTED";
          }
        });
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updatedIds: body?.ids ?? [] }),
      });
    });

    await page.route("**/api/expert/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            totalContentCount: projects.length,
            totalViews: projects.reduce((sum, project) => sum + project.views, 0),
            totalLikes: projects.reduce((sum, project) => sum + project.likes, 0),
            pendingApplicantCount: applications.filter(
              (application) => application.status === "SUBMITTED",
            ).length,
          },
          myContents: projects,
          collaborationOpportunities: [],
          inboundApplications: applications.map((application) => ({
            ...application,
            applicant: {
              id: USERS.learner.id,
              name: USERS.learner.name,
              email: USERS.learner.email,
              role: USERS.learner.role,
              avatar: USERS.learner.avatar || "",
            },
            target: {
              ...application.target,
            },
          })),
          enterpriseConnections: [],
        }),
      });
    });

    await page.route("**/api/learner/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: {
            publishedContentCount: 0,
            availableContentCount: projects.filter(
              (project) => project.status === "PUBLISHED",
            ).length,
            pendingReviewCount: 0,
            applicationCount: applications.length,
          },
          learningResources: [],
          projectOpportunities: projects.filter(
            (project) => project.status === "PUBLISHED",
          ),
          recommendedContents: [],
          myContents: [],
          applications: applications.map((application) => ({
            ...application,
            target: {
              ...application.target,
            },
            owner: {
              id: USERS.expert.id,
              name: USERS.expert.name,
              email: USERS.expert.email,
              role: USERS.expert.role,
              avatar: USERS.expert.avatar || "",
            },
          })),
        }),
      });
    });

    await page.goto("/admin/review");

    await expect(
      page.getByTestId("review-audit-row-audit-batch-application-1"),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-audit-row-audit-batch-application-2"),
    ).toBeVisible();

    await page.getByTestId("review-audit-select-visible").click();
    await page.getByTestId("review-audit-batch-reject-target-content").click();

    await expect(
      page.getByTestId("review-audit-row-audit-batch-application-1"),
    ).toContainText("REJECTED");
    await expect(
      page.getByTestId("review-audit-row-audit-batch-application-2"),
    ).toContainText("REJECTED");

    expect(batchActionBody).toMatchObject({
      action: "REJECT_TARGET_CONTENT",
      ids: ["audit-batch-application-1", "audit-batch-application-2"],
    });

    await switchAuth(page, USERS.expert);
    await page.goto("/app/expert");

    await expect(
      page.getByTestId(
        "expert-application-target-status-audit-batch-application-1",
      ),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId(
        "expert-application-target-status-audit-batch-application-2",
      ),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId("expert-approve-audit-batch-application-1"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("expert-approve-audit-batch-application-2"),
    ).toHaveCount(0);

    await switchAuth(page, USERS.learner);
    await page.goto("/app/learner");

    await expect(
      page.getByTestId(
        "learner-application-target-status-audit-batch-application-1",
      ),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId(
        "learner-application-target-status-audit-batch-application-2",
      ),
    ).toContainText("Rejected");

    expect(
      requests.some((url) => url.includes("/api/applications/audit/actions")),
    ).toBeTruthy();
  });

  test("allows learners to re-apply after an expert owner rejects the application", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

    const project = {
      id: "project-flow-reject-1",
      title: "Expert Rejection Loop",
      description: "Validate reject and re-apply for expert-owned projects.",
      type: "PROJECT",
      status: "PUBLISHED",
      authorId: USERS.expert.id,
      createdAt: new Date("2026-03-14T08:00:00.000Z").toISOString(),
      tags: ["Research"],
      likes: 0,
      views: 9,
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
        id: "expert-reject-application-1",
        applicantId: USERS.learner.id,
        targetType: "PROJECT",
        targetId: String(body.targetId ?? project.id),
        message:
          typeof body.message === "string" ? body.message : undefined,
        status: "SUBMITTED",
        createdAt: new Date("2026-03-15T13:00:00.000Z").toISOString(),
      };

      if (applications[0]) {
        applications[0] = nextApplication;
      } else {
        applications.push(nextApplication);
      }

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
    await page.getByTestId("learner-apply-project-flow-reject-1").click();
    await page
      .getByTestId("learner-apply-message-project-flow-reject-1")
      .fill("First application round.");
    await page
      .getByTestId("learner-submit-application-project-flow-reject-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("SUBMITTED");

    await switchAuth(page, USERS.expert);
    await page.goto("/app/expert");
    await page.getByTestId("expert-reject-expert-reject-application-1").click();

    await expect.poll(() => applications[0]?.status).toBe("REJECTED");

    await switchAuth(page, USERS.learner);
    await page.goto("/app/learner");

    await expect(
      page.getByTestId("learner-application-status-expert-reject-application-1"),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId("learner-apply-project-flow-reject-1"),
    ).toBeVisible();

    await page.getByTestId("learner-apply-project-flow-reject-1").click();
    await page
      .getByTestId("learner-apply-message-project-flow-reject-1")
      .fill("Second application round after feedback.");
    await page
      .getByTestId("learner-submit-application-project-flow-reject-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("SUBMITTED");

    await switchAuth(page, USERS.expert);
    await page.goto("/app/expert");
    await expect(
      page.getByTestId("expert-reject-expert-reject-application-1"),
    ).toBeVisible();
  });

  test("allows learners to re-apply after an enterprise owner rejects the application", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    await mockShellApis(page, requests);
    await mockAdminAuditLogApis(page, requests);

    const enterpriseNeed = {
      id: "enterprise-need-flow-reject-1",
      title: "Enterprise Rejection Loop",
      description: "Validate reject and re-apply for enterprise-owned needs.",
      type: "PROJECT",
      status: "PUBLISHED",
      contentDomain: "ENTERPRISE_NEED",
      authorId: USERS.enterprise.id,
      createdAt: new Date("2026-03-14T09:00:00.000Z").toISOString(),
      tags: ["Enterprise"],
      likes: 0,
      views: 11,
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
      target?: {
        id: string;
        targetType: string;
        contentType: string;
        contentDomain: string;
        title: string;
        status: string;
        ownerId: string;
      };
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
          projectOpportunities: [enterpriseNeed],
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
        id: "enterprise-reject-application-1",
        applicantId: USERS.learner.id,
        targetType: "PROJECT",
        targetId: String(body.targetId ?? enterpriseNeed.id),
        message:
          typeof body.message === "string" ? body.message : undefined,
        status: "SUBMITTED",
        createdAt: new Date("2026-03-15T13:30:00.000Z").toISOString(),
        target: {
          id: enterpriseNeed.id,
          targetType: "PROJECT",
          contentType: enterpriseNeed.type,
          contentDomain: enterpriseNeed.contentDomain,
          title: enterpriseNeed.title,
          status: enterpriseNeed.status,
          ownerId: enterpriseNeed.authorId,
        },
      };

      if (applications[0]) {
        applications[0] = nextApplication;
      } else {
        applications.push(nextApplication);
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(nextApplication),
      });
    });

    await page.route("**/api/enterprise/dashboard", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            aiStrategy: "Enterprise test",
            whatImDoing: "Testing reject flows",
            whatImLookingFor: "Reliable applicants",
          },
          stats: {
            recommendedExpertsCount: 0,
            activeConversationsCount: 0,
            postedNeedsCount: 1,
            pendingInboundApplicationsCount: applications.filter(
              (item) => item.status === "SUBMITTED",
            ).length,
          },
          recommendedExperts: [],
          myContents: [enterpriseNeed],
          inboundApplications: applications.map((item) => ({
            ...item,
            applicant: {
              id: USERS.learner.id,
              name: USERS.learner.name,
              email: USERS.learner.email,
              role: USERS.learner.role,
              avatar: USERS.learner.avatar || "",
            },
            targetContentTitle: enterpriseNeed.title,
          })),
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
    await page
      .getByTestId("learner-apply-enterprise-need-flow-reject-1")
      .click();
    await page
      .getByTestId("learner-apply-message-enterprise-need-flow-reject-1")
      .fill("First enterprise application.");
    await page
      .getByTestId("learner-submit-application-enterprise-need-flow-reject-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("SUBMITTED");

    await switchAuth(page, USERS.enterprise);
    await page.goto("/app/enterprise");
    await page
      .getByTestId("enterprise-reject-enterprise-reject-application-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("REJECTED");

    await switchAuth(page, USERS.learner);
    await page.goto("/app/learner");

    await expect(
      page.getByTestId(
        "learner-application-status-enterprise-reject-application-1",
      ),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId("learner-apply-enterprise-need-flow-reject-1"),
    ).toBeVisible();

    await page
      .getByTestId("learner-apply-enterprise-need-flow-reject-1")
      .click();
    await page
      .getByTestId("learner-apply-message-enterprise-need-flow-reject-1")
      .fill("Second enterprise application after feedback.");
    await page
      .getByTestId("learner-submit-application-enterprise-need-flow-reject-1")
      .click();

    await expect.poll(() => applications[0]?.status).toBe("SUBMITTED");

    await switchAuth(page, USERS.enterprise);
    await page.goto("/app/enterprise");
    await expect(
      page.getByTestId("enterprise-reject-enterprise-reject-application-1"),
    ).toBeVisible();
  });
});
