import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockEnterpriseDashboardApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("enterprise dashboard", () => {
  test("saves AI strategy through the enterprise profile API", async ({
    page,
  }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    const updateRequests: Array<Record<string, string>> = [];

    await mockEnterpriseDashboardApis(page, {
      enterpriseProfile: {
        userId: USERS.enterprise.id,
        aiStrategyText: "Current strategy",
        casesText: "Current focus",
        achievementsText: "Current needs",
      },
      onProfileUpdate: (body) => {
        updateRequests.push(body);
      },
    });

    await page.goto("/app/enterprise");
    await page.getByRole("button", { name: /^Edit$/ }).click();

    await page
      .getByTestId("enterprise-ai-strategy-input")
      .fill("Platform AI moat");
    await page
      .getByTestId("enterprise-current-focus-input")
      .fill("Agent integration");
    await page
      .getByTestId("enterprise-looking-for-input")
      .fill("Applied researchers");
    await page.getByTestId("enterprise-save-strategy-btn").click();

    await expect.poll(() => updateRequests.length).toBe(1);
    expect(updateRequests[0]).toEqual({
      aiStrategyText: "Platform AI moat",
      casesText: "Agent integration",
      achievementsText: "Applied researchers",
    });

    await expect(page.getByText("Platform AI moat")).toBeVisible();
    await expect(page.getByText("Agent integration")).toBeVisible();
    await expect(page.getByText("Applied researchers")).toBeVisible();
  });

  test("quick posts enterprise needs through the unified publish flow", async ({
    page,
  }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    const publishRequests: Array<Record<string, unknown>> = [];

    await mockEnterpriseDashboardApis(page, {
      enterpriseProfile: {
        userId: USERS.enterprise.id,
        aiStrategyText: "",
        casesText: "",
        achievementsText: "",
      },
      onPublishCreate: (body) => {
        publishRequests.push(body);
      },
    });

    await page.goto("/app/enterprise");
    await page.getByRole("button", { name: /^Quick Post$/ }).click();

    await page
      .getByTestId("enterprise-quick-post-title-input")
      .fill("Unified Ops Copilot");
    await page
      .getByTestId("enterprise-quick-post-description-input")
      .fill("Need experts to stabilize the rollout plan.");
    await page
      .getByTestId("enterprise-quick-post-tags-input")
      .fill("ops, agents");
    await page.getByTestId("enterprise-quick-post-submit-btn").click();

    await expect.poll(() => publishRequests.length).toBe(1);
    expect(publishRequests[0]).toEqual({
      title: "Unified Ops Copilot",
      description: "Need experts to stabilize the rollout plan.",
      type: "PROJECT",
      tags: ["ops", "agents"],
      visibility: "public_all",
    });

    await expect(page.getByText("Unified Ops Copilot")).toBeVisible();
    await expect(
      page.getByTestId("enterprise-content-domain-publish-enterprise-1"),
    ).toContainText("Enterprise Need");
  });

  test("shows inbound application targets with content-domain context", async ({
    page,
  }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    await mockEnterpriseDashboardApis(page, {
      enterpriseProfile: {
        userId: USERS.enterprise.id,
        aiStrategyText: "",
        casesText: "",
        achievementsText: "",
      },
      myContents: [
        {
          id: "need-dashboard-1",
          title: "Enterprise Rollout Need",
          description: "Need support on deployment planning.",
          type: "PROJECT",
          contentDomain: "ENTERPRISE_NEED",
          status: "PUBLISHED",
          authorId: USERS.enterprise.id,
          createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
          tags: ["Rollout"],
          likes: 0,
          views: 5,
          background: "Current deployment handoff is fragmented.",
          goal: "Ship a repeatable rollout checklist.",
          visibility: "ALL",
        },
      ],
      myApplications: [
        {
          id: "enterprise-app-1",
          applicantId: USERS.learner.id,
          targetType: "ENTERPRISE_NEED",
          targetId: "need-dashboard-1",
          message: "I can support rollout validation.",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-15T09:00:00.000Z").toISOString(),
          targetContentTitle: "Enterprise Rollout Need",
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

    await page.goto("/app/enterprise");

    await expect(
      page.getByTestId("enterprise-content-preview-need-dashboard-1-background"),
    ).toContainText("Current deployment handoff is fragmented.");
    await expect(
      page.getByTestId("enterprise-application-target-enterprise-app-1"),
    ).toHaveText("Enterprise Rollout Need");
    await expect(
      page.getByTestId("enterprise-application-domain-enterprise-app-1"),
    ).toContainText("Enterprise Need");
  });

  test("hides inbound application actions when the target need is no longer published", async ({
    page,
  }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    await mockEnterpriseDashboardApis(page, {
      enterpriseProfile: {
        userId: USERS.enterprise.id,
        aiStrategyText: "",
        casesText: "",
        achievementsText: "",
      },
      myContents: [
        {
          id: "need-closed-1",
          title: "Archived Need",
          description: "No longer active after governance review.",
          type: "PROJECT",
          contentDomain: "ENTERPRISE_NEED",
          status: "REJECTED",
          authorId: USERS.enterprise.id,
          createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
          tags: ["Archived"],
          likes: 0,
          views: 0,
          visibility: "ALL",
        },
      ],
      myApplications: [
        {
          id: "enterprise-closed-app-1",
          applicantId: USERS.learner.id,
          targetType: "ENTERPRISE_NEED",
          targetId: "need-closed-1",
          message: "Available if this need comes back.",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-15T09:00:00.000Z").toISOString(),
          targetContentTitle: "Archived Need",
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

    await page.goto("/app/enterprise");

    await expect(
      page.getByTestId(
        "enterprise-application-target-status-enterprise-closed-app-1",
      ),
    ).toContainText("Rejected");
    await expect(
      page.getByTestId("enterprise-approve-enterprise-closed-app-1"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("enterprise-reject-enterprise-closed-app-1"),
    ).toHaveCount(0);
  });

  test("hides inbound application actions when the applicant account is suspended", async ({
    page,
  }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    await mockEnterpriseDashboardApis(page, {
      enterpriseProfile: {
        userId: USERS.enterprise.id,
        aiStrategyText: "",
        casesText: "",
        achievementsText: "",
      },
      myContents: [
        {
          id: "need-live-1",
          title: "Published Need",
          description: "Actively looking for contributors.",
          type: "PROJECT",
          contentDomain: "ENTERPRISE_NEED",
          status: "PUBLISHED",
          authorId: USERS.enterprise.id,
          createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
          tags: ["Delivery"],
          likes: 0,
          views: 0,
          visibility: "ALL",
        },
      ],
      myApplications: [
        {
          id: "enterprise-suspended-app-1",
          applicantId: USERS.learner.id,
          targetType: "ENTERPRISE_NEED",
          targetId: "need-live-1",
          message: "I can help after appeal review.",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-15T09:00:00.000Z").toISOString(),
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

    await page.goto("/app/enterprise");

    await expect(
      page.getByTestId(
        "enterprise-application-applicant-status-enterprise-suspended-app-1",
      ),
    ).toContainText("Applicant suspended");
    await expect(
      page.getByTestId("enterprise-approve-enterprise-suspended-app-1"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("enterprise-reject-enterprise-suspended-app-1"),
    ).toHaveCount(0);
  });
});
