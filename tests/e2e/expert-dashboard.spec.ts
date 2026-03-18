import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockExpertDashboardApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("expert dashboard", () => {
  test("renders aggregated dashboard data and approves an applicant", async ({
    page,
  }) => {
    await seedAuth(page, USERS.expert);
    await installStrictApiMocking(page);

    const applicationUpdates: Array<{ appId: string; body: Record<string, string> }> = [];

    await mockExpertDashboardApis(page, {
      myContents: [
        {
          id: "content-1",
          title: "Applied AI Paper",
          description: "Research update",
          type: "PAPER",
          contentDomain: "HUB_ITEM",
          status: "PUBLISHED",
          authorId: USERS.expert.id,
          createdAt: new Date("2026-03-13T10:00:00.000Z").toISOString(),
          tags: ["AI"],
          likes: 12,
          views: 120,
        },
        {
          id: "research-1",
          title: "Evaluation Research Track",
          description: "Need learner support for benchmark analysis",
          type: "PROJECT",
          contentDomain: "RESEARCH_PROJECT",
          status: "PUBLISHED",
          authorId: USERS.expert.id,
          createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
          tags: ["Evaluation"],
          likes: 0,
          views: 0,
          neededSupport: "Need learner support for benchmark analysis",
        },
      ],
      collaborationOpportunities: [
        {
          id: "need-1",
          title: "Enterprise collaboration project",
          description: "Need an expert partner",
          type: "PROJECT",
          contentDomain: "ENTERPRISE_NEED",
          status: "PUBLISHED",
          authorId: USERS.enterprise.id,
          createdAt: new Date("2026-03-13T11:00:00.000Z").toISOString(),
          tags: ["Collaboration"],
          likes: 0,
          views: 8,
          background: "Internal delivery is blocked on evaluation design.",
          goal: "Launch a reusable evaluation track this quarter.",
          visibility: "EXPERTS_LEARNERS",
          author: {
            id: USERS.enterprise.id,
            name: USERS.enterprise.name,
            email: USERS.enterprise.email,
            role: USERS.enterprise.role,
            avatar: USERS.enterprise.avatar || "",
          },
        },
      ],
      inboundApplications: [
        {
          id: "app-1",
          applicantId: USERS.learner.id,
          targetType: "RESEARCH_PROJECT",
          targetId: "research-1",
          message: "Happy to assist",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-13T12:00:00.000Z").toISOString(),
          targetContentTitle: "Evaluation Research Track",
          applicant: {
            id: USERS.learner.id,
            name: USERS.learner.name,
            email: USERS.learner.email,
            role: USERS.learner.role,
            avatar: USERS.learner.avatar || "",
          },
        },
      ],
      enterpriseConnections: [
        {
          id: USERS.enterprise.id,
          name: USERS.enterprise.name,
          email: USERS.enterprise.email,
          role: USERS.enterprise.role,
          avatar: USERS.enterprise.avatar || "",
          title: "Innovation Lead",
          company: "AI Works",
        },
      ],
      onApplicationStatusUpdate: (appId, body) => {
        applicationUpdates.push({ appId, body });
      },
    });

    await page.goto("/app/expert");

    await expect(page.getByTestId("expert-content-domain-research-1")).toContainText(
      "Research Project",
      { timeout: 10000 },
    );
    await expect(
      page.getByTestId("expert-content-preview-research-1-neededSupport"),
    ).toContainText("Need learner support for benchmark analysis");
    await expect(
      page.getByRole("link", { name: /Applied AI Paper/ }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Evaluation Research Track/ }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Enterprise collaboration project/ }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(USERS.enterprise.name).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("expert-collab-domain-need-1")).toContainText(
      "Enterprise Need",
      { timeout: 10000 },
    );
    await expect(
      page.getByTestId("expert-collab-preview-need-1-background"),
    ).toContainText("Internal delivery is blocked on evaluation design.");
    await expect(
      page.getByTestId("expert-application-target-app-1"),
    ).toHaveText("Evaluation Research Track");
    await expect(
      page.getByTestId("expert-application-domain-app-1"),
    ).toContainText("Research Project");

    await page.getByRole("button", { name: /^Approve$/ }).click();

    await expect.poll(() => applicationUpdates.length).toBe(1);
    expect(applicationUpdates[0]).toEqual({
      appId: "app-1",
      body: { status: "accepted" },
    });
  });

  test("hides applicant actions when the target content is no longer published", async ({
    page,
  }) => {
    await seedAuth(page, USERS.expert);
    await installStrictApiMocking(page);

    await mockExpertDashboardApis(page, {
      myContents: [
        {
          id: "research-closed-1",
          title: "Retired Research Track",
          description: "This target has been rejected by governance.",
          type: "PROJECT",
          contentDomain: "RESEARCH_PROJECT",
          status: "REJECTED",
          authorId: USERS.expert.id,
          createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
          tags: ["Research"],
          likes: 0,
          views: 0,
        },
      ],
      inboundApplications: [
        {
          id: "app-closed-1",
          applicantId: USERS.learner.id,
          targetType: "RESEARCH_PROJECT",
          targetId: "research-closed-1",
          message: "Still happy to help if reopened.",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-15T12:00:00.000Z").toISOString(),
          applicant: {
            id: USERS.learner.id,
            name: USERS.learner.name,
            email: USERS.learner.email,
            role: USERS.learner.role,
            avatar: USERS.learner.avatar || "",
          },
        },
      ],
    });

    await page.goto("/app/expert");

    await expect(
      page.getByTestId("expert-application-target-status-app-closed-1"),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId("expert-approve-app-closed-1"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("expert-reject-app-closed-1"),
    ).toHaveCount(0);
  });

  test("hides applicant actions when the applicant account is suspended", async ({
    page,
  }) => {
    await seedAuth(page, USERS.expert);
    await installStrictApiMocking(page);

    await mockExpertDashboardApis(page, {
      myContents: [
        {
          id: "research-live-1",
          title: "Live Research Track",
          description: "Published and currently accepting help.",
          type: "PROJECT",
          contentDomain: "RESEARCH_PROJECT",
          status: "PUBLISHED",
          authorId: USERS.expert.id,
          createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
          tags: ["Research"],
          likes: 0,
          views: 0,
        },
      ],
      inboundApplications: [
        {
          id: "app-suspended-1",
          applicantId: USERS.learner.id,
          targetType: "RESEARCH_PROJECT",
          targetId: "research-live-1",
          message: "Happy to assist once my account is restored.",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-15T12:00:00.000Z").toISOString(),
          applicant: {
            id: USERS.learner.id,
            name: USERS.learner.name,
            email: USERS.learner.email,
            role: USERS.learner.role,
            avatar: USERS.learner.avatar || "",
            status: "suspended",
          },
        },
      ],
    });

    await page.goto("/app/expert");

    await expect(
      page.getByTestId("expert-application-applicant-status-app-suspended-1"),
    ).toContainText("Applicant suspended");
    await expect(
      page.getByTestId("expert-approve-app-suspended-1"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("expert-reject-app-suspended-1"),
    ).toHaveCount(0);
  });
});
