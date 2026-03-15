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
          status: "PUBLISHED",
          authorId: USERS.expert.id,
          createdAt: new Date("2026-03-13T10:00:00.000Z").toISOString(),
          tags: ["AI"],
          likes: 12,
          views: 120,
        },
      ],
      collaborationOpportunities: [
        {
          id: "content-2",
          title: "Enterprise collaboration project",
          description: "Need an expert partner",
          type: "PROJECT",
          status: "PUBLISHED",
          authorId: USERS.enterprise.id,
          createdAt: new Date("2026-03-13T11:00:00.000Z").toISOString(),
          tags: ["Collaboration"],
          likes: 0,
          views: 8,
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
          targetType: "PROJECT",
          targetId: "content-1",
          message: "Happy to assist",
          status: "SUBMITTED",
          createdAt: new Date("2026-03-13T12:00:00.000Z").toISOString(),
          targetContentTitle: "Applied AI Paper",
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

    await expect(page.getByRole("link", { name: /Applied AI Paper/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Enterprise collaboration project/ }).first()).toBeVisible();
    await expect(page.getByText(USERS.enterprise.name).first()).toBeVisible();

    await page.getByRole("button", { name: /^Approve$/ }).click();

    await expect.poll(() => applicationUpdates.length).toBe(1);
    expect(applicationUpdates[0]).toEqual({
      appId: "app-1",
      body: { status: "accepted" },
    });
  });
});
