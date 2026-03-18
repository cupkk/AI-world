import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockAdminReviewApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("review", () => {
  test("allows admins to approve pending content", async ({ page }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);
    await mockAdminReviewApis(page, {
      reviewItems: [
        {
          id: "pending-1",
          title: "Pending Research Project",
          description: "Need admin review",
          type: "PROJECT",
          contentDomain: "RESEARCH_PROJECT",
          status: "PENDING_REVIEW",
          authorId: "author-1",
          createdAt: new Date().toISOString(),
          tags: ["AI"],
          likes: 0,
          views: 0,
          visibility: "ALL",
          neededSupport: "Looking for compute credits",
        },
      ],
      authors: [
        {
          id: "author-1",
          name: "Author One",
          role: "LEARNER",
        },
      ],
    });

    await page.goto("/admin/review");
    await expect(
      page.getByRole("heading", { name: "Pending Research Project" }),
    ).toBeVisible();
    await expect(page.getByText("Author One")).toBeVisible();
    await expect(page.getByTestId("review-domain-pending-1")).toContainText(
      "Research Project",
    );
    await expect(
      page.getByTestId("review-preview-pending-1-summary"),
    ).toHaveText("Need admin review");
    await expect(
      page.getByTestId("review-preview-pending-1-neededSupport"),
    ).toHaveText("Looking for compute credits");

    await page.getByTestId("review-approve-pending-1").click();

    await expect(
      page.getByRole("heading", { name: "Pending Research Project" }),
    ).not.toBeVisible();
  });

  test("allows admins to resolve pending reports", async ({ page }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);
    await mockAdminReviewApis(page, {
      reviewItems: [],
      reports: [
        {
          id: "report-1",
          targetType: "user",
          targetId: "reported-user-1",
          reason: "Spam messages",
          status: "PENDING",
          reporterId: "reporter-1",
          reporterName: "Reporter One",
          createdAt: new Date().toISOString(),
        },
      ],
      authors: [
        {
          id: "reporter-1",
          name: "Reporter One",
          role: "EXPERT",
        },
      ],
    });

    await page.goto("/admin/review");
    await expect(page.getByText("Spam messages")).toBeVisible();

    await page
      .getByRole("button", { name: /Mark as Resolved|标记已处理/ })
      .click();

    await expect(page.getByText("Spam messages")).not.toBeVisible();
  });

  test("shows application audit rows with search and filters", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);
    await mockAdminReviewApis(page, {
      reviewItems: [],
      reports: [],
      auditItems: [
        {
          id: "app-1",
          status: "SUBMITTED",
          createdAt: new Date().toISOString(),
          ageInDays: 11,
          auditFlags: ["STALE_SUBMITTED"],
          message: "Looking to contribute to the benchmark workstream.",
          targetContentTitle: "LLM Benchmark Project",
          applicant: {
            id: "learner-1",
            name: "Learner One",
            email: "learner@example.com",
            role: "LEARNER",
          },
          owner: {
            id: "expert-1",
            name: "Expert One",
            email: "expert@example.com",
            role: "EXPERT",
          },
          target: {
            id: "project-1",
            title: "LLM Benchmark Project",
            contentType: "PROJECT",
            status: "PUBLISHED",
            targetType: "PROJECT",
            ownerId: "expert-1",
          },
        },
        {
          id: "app-2",
          status: "ACCEPTED",
          createdAt: new Date().toISOString(),
          ageInDays: 1,
          auditFlags: ["TARGET_NOT_PUBLISHED"],
          message: "Can support data pipeline delivery this quarter.",
          targetContentTitle: "Enterprise Search Rollout",
          applicant: {
            id: "expert-2",
            name: "Expert Two",
            email: "expert-two@example.com",
            role: "EXPERT",
          },
          owner: {
            id: "enterprise-1",
            name: "Enterprise Lead",
            email: "lead@example.com",
            role: "ENTERPRISE",
          },
          target: {
            id: "need-1",
            title: "Enterprise Search Rollout",
            contentType: "ENTERPRISE_NEED",
            status: "PENDING_REVIEW",
            targetType: "ENTERPRISE_NEED",
            ownerId: "enterprise-1",
          },
        },
      ],
    });

    await page.goto("/admin/review");

    await expect(page.getByTestId("review-audit-row-app-1")).toBeVisible();
    await expect(page.getByTestId("review-audit-row-app-2")).toBeVisible();

    await page.getByTestId("review-audit-search").fill("Enterprise Search");
    await expect(page.getByTestId("review-audit-row-app-2")).toBeVisible();
    await expect(page.getByTestId("review-audit-row-app-1")).not.toBeVisible();

    await page.getByTestId("review-audit-search").fill("");
    await page.getByTestId("review-audit-status-accepted").click();
    await expect(page.getByTestId("review-audit-row-app-2")).toBeVisible();
    await expect(page.getByTestId("review-audit-row-app-1")).not.toBeVisible();

    await page.getByTestId("review-audit-target-enterprise_need").click();
    await expect(page.getByTestId("review-audit-row-app-2")).toBeVisible();

    await page.getByTestId("review-audit-status-all").click();
    await page.getByTestId("review-audit-target-all").click();
    await page.getByTestId("review-audit-flag-stale_submitted").click();
    await expect(page.getByTestId("review-audit-row-app-1")).toBeVisible();
    await expect(page.getByTestId("review-audit-row-app-2")).not.toBeVisible();

    await expect(
      page.getByTestId("review-audit-row-app-1").getByText("Stale pending"),
    ).toBeVisible();

    await page.getByTestId("review-audit-target-all").click();
    await page.getByTestId("review-audit-flag-all").click();
    await expect(page.getByTestId("review-audit-row-app-1")).toBeVisible();
    await expect(page.getByTestId("review-audit-row-app-2")).toBeVisible();

    await page.getByTestId("review-audit-flag-target_not_published").click();
    await expect(page.getByTestId("review-audit-row-app-2")).toBeVisible();
    await expect(page.getByTestId("review-audit-row-app-1")).not.toBeVisible();
    await expect(
      page.getByTestId("review-audit-row-app-2").getByText("Target not live"),
    ).toBeVisible();

    await page.getByTestId("review-audit-flag-all").click();
    await page.getByTestId("review-audit-select-app-1").click();
    await page.getByTestId("review-audit-batch-mark-reviewed").click();

    await expect(
      page.getByTestId("review-audit-row-app-1").getByText("Reviewed"),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-audit-action-mark-reviewed-app-1"),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-audit-timeline-app-1-0"),
    ).toContainText("Admin One");

    await page.getByTestId("review-audit-governance-reviewed").click();
    await expect(page.getByTestId("review-audit-row-app-1")).toBeVisible();
    await expect(page.getByTestId("review-audit-row-app-2")).not.toBeVisible();
  });

  test("allows admins to reject linked target content from the audit view", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);
    await mockAdminReviewApis(page, {
      reviewItems: [],
      reports: [],
      auditItems: [
        {
          id: "app-target-1",
          status: "ACCEPTED",
          createdAt: new Date().toISOString(),
          ageInDays: 2,
          auditFlags: ["TARGET_NOT_PUBLISHED"],
          message: "Can help restabilize delivery.",
          targetContentTitle: "Ops Copilot Rollout",
          applicant: {
            id: "expert-10",
            name: "Expert Ten",
            email: "expert-ten@example.com",
            role: "EXPERT",
          },
          owner: {
            id: "enterprise-10",
            name: "Enterprise Ten",
            email: "enterprise-ten@example.com",
            role: "ENTERPRISE",
          },
          target: {
            id: "need-10",
            title: "Ops Copilot Rollout",
            contentType: "ENTERPRISE_NEED",
            status: "PENDING_REVIEW",
            targetType: "ENTERPRISE_NEED",
            ownerId: "enterprise-10",
          },
        },
      ],
    });

    await page.goto("/admin/review");

    await expect(
      page.getByTestId(
        "review-audit-action-reject-target-content-app-target-1",
      ),
    ).toBeVisible();

    await page
      .getByTestId("review-audit-action-reject-target-content-app-target-1")
      .click();

    await expect(
      page.getByTestId("review-audit-row-app-target-1").getByText("REJECTED"),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-audit-timeline-app-target-1-0"),
    ).toContainText("Reject target content");
  });

  test("shows governance activity as a searchable standalone feed", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);
    await mockAdminReviewApis(page, {
      reviewItems: [],
      reports: [],
      auditItems: [
        {
          id: "app-governance-1",
          status: "SUBMITTED",
          createdAt: new Date().toISOString(),
          ageInDays: 4,
          message: "Can help restabilize delivery.",
          targetContentTitle: "Ops Copilot Rollout",
          applicant: {
            id: "expert-10",
            name: "Expert Ten",
            email: "expert-ten@example.com",
            role: "EXPERT",
          },
          owner: {
            id: "enterprise-10",
            name: "Enterprise Ten",
            email: "enterprise-ten@example.com",
            role: "ENTERPRISE",
          },
          target: {
            id: "need-10",
            title: "Ops Copilot Rollout",
            contentType: "PROJECT",
            status: "REJECTED",
            targetType: "ENTERPRISE_NEED",
            ownerId: "enterprise-10",
          },
          governanceState: "REVIEWED",
          latestGovernanceAction: {
            action: "REJECT_TARGET_CONTENT",
            actorId: USERS.admin.id,
            actorName: USERS.admin.name,
            createdAt: new Date("2026-03-16T10:00:00.000Z").toISOString(),
            reason: "Target no longer passes governance review.",
          },
          governanceTimeline: [
            {
              action: "REJECT_TARGET_CONTENT",
              actorId: USERS.admin.id,
              actorName: USERS.admin.name,
              createdAt: new Date("2026-03-16T10:00:00.000Z").toISOString(),
              reason: "Target no longer passes governance review.",
            },
          ],
        },
        {
          id: "app-governance-2",
          status: "SUBMITTED",
          createdAt: new Date().toISOString(),
          ageInDays: 2,
          message: "Waiting for governance update.",
          targetContentTitle: "Research Sprint",
          applicant: {
            id: "learner-11",
            name: "Learner Eleven",
            email: "learner-eleven@example.com",
            role: "LEARNER",
          },
          owner: {
            id: "expert-11",
            name: "Expert Eleven",
            email: "expert-eleven@example.com",
            role: "EXPERT",
          },
          target: {
            id: "project-11",
            title: "Research Sprint",
            contentType: "PROJECT",
            status: "PUBLISHED",
            targetType: "RESEARCH_PROJECT",
            ownerId: "expert-11",
          },
          governanceState: "REVIEWED",
          latestGovernanceAction: {
            action: "SUSPEND_OWNER",
            actorId: USERS.admin.id,
            actorName: USERS.admin.name,
            createdAt: new Date("2026-03-17T10:00:00.000Z").toISOString(),
          },
          governanceTimeline: [
            {
              action: "SUSPEND_OWNER",
              actorId: USERS.admin.id,
              actorName: USERS.admin.name,
              createdAt: new Date("2026-03-17T10:00:00.000Z").toISOString(),
            },
          ],
        },
      ],
    });

    await page.goto("/admin/review");

    await expect(
      page.getByTestId("review-governance-row-app-governance-1-0"),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-governance-row-app-governance-2-0"),
    ).toBeVisible();

    await page.getByTestId("review-governance-search").fill("Research Sprint");
    await expect(
      page.getByTestId("review-governance-row-app-governance-2-0"),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-governance-row-app-governance-1-0"),
    ).not.toBeVisible();

    await page.getByTestId("review-governance-search").fill("");
    await page.getByTestId("review-governance-action-suspend_owner").click();
    await expect(
      page.getByTestId("review-governance-row-app-governance-2-0"),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-governance-row-app-governance-1-0"),
    ).not.toBeVisible();
  });

  test("shows backend admin audit logs outside application governance actions", async ({
    page,
  }) => {
    await seedAuth(page, USERS.admin);
    await installStrictApiMocking(page);
    await mockAdminReviewApis(page, {
      reviewItems: [],
      reports: [],
      auditItems: [],
      auditLogs: [
        {
          id: "audit-log-user-1",
          action: "update_user_status",
          targetType: "USER",
          targetId: "user-20",
          createdAt: new Date("2026-03-17T11:00:00.000Z").toISOString(),
          actorId: USERS.admin.id,
          actor: USERS.admin,
          target: {
            id: "user-20",
            targetType: "USER",
            title: "Learner Twenty",
            status: "SUSPENDED",
          },
        },
      ],
    });

    await page.goto("/admin/review");

    await expect(
      page.getByTestId("review-governance-row-audit-log-user-1"),
    ).toBeVisible();
    await expect(page.getByText("Learner Twenty")).toBeVisible();

    await page.getByTestId("review-governance-action-update_user_status").click();
    await expect(
      page.getByTestId("review-governance-row-audit-log-user-1"),
    ).toBeVisible();

    await page.getByTestId("review-governance-search").fill("Learner Twenty");
    await expect(
      page.getByTestId("review-governance-row-audit-log-user-1"),
    ).toBeVisible();
  });
});
