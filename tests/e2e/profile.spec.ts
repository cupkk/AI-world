import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("profile", () => {
  test("uses the aggregated profile page API without fetching the hub list", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const requests: string[] = [];

    await page.route("**/api/profiles/user-1/page", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            name: "Research Lead",
            email: "lead@example.com",
            role: "EXPERT",
            avatar: "",
            bio: "Building practical AI policy workflows.",
            title: "Policy expert",
            company: "AI World Lab",
            location: "Singapore",
            whatImDoing: "Running evaluation pilots.",
            whatICanProvide: "Research design and reviews.",
            whatImLookingFor: "Implementation partners.",
          },
          contents: [
            {
              id: "hub-1",
              title: "Policy Sprint",
              description: "A practical policy workflow.",
              type: "PROJECT",
              contentDomain: "HUB_ITEM",
              status: "PUBLISHED",
              authorId: "user-1",
              createdAt: new Date("2026-03-14T10:00:00.000Z").toISOString(),
              tags: ["Policy"],
              likes: 4,
              views: 9,
            },
            {
              id: "need-1",
              title: "Applied Evaluation Need",
              description: "Looking for a repeatable evaluation workflow.",
              type: "PROJECT",
              contentDomain: "ENTERPRISE_NEED",
              status: "PUBLISHED",
              authorId: "user-1",
              createdAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
              tags: ["Evaluation"],
              likes: 0,
              views: 0,
              background: "Current workflow is fragmented across teams.",
              goal: "Ship a reusable enterprise evaluation pilot.",
              deliverables: "Shared benchmark workflow and rollout notes.",
              visibility: "ALL",
            },
            {
              id: "research-1",
              title: "Research Collaboration Track",
              description: "An open research collaboration.",
              type: "PROJECT",
              contentDomain: "RESEARCH_PROJECT",
              status: "PUBLISHED",
              authorId: "user-1",
              createdAt: new Date("2026-03-16T10:00:00.000Z").toISOString(),
              tags: ["Research"],
              likes: 0,
              views: 0,
              neededSupport: "Need benchmark instrumentation support.",
            },
          ],
          summary: {
            publishedContentCount: 3,
            totalViews: 9,
            totalLikes: 4,
            featuredTypes: ["PROJECT"],
            domainCounts: {
              hubItems: 1,
              enterpriseNeeds: 1,
              researchProjects: 1,
            },
          },
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

    await page.goto("/u/user-1");

    await expect(page.getByText("Research Lead")).toBeVisible();
    await expect(page.getByTestId("profile-direct-message")).toBeVisible();
    await expect(
      page.getByTestId("profile-contact-send-message"),
    ).toBeVisible();
    await expect(page.getByText("Policy Sprint")).toBeVisible();
    await expect(page.getByText("Applied Evaluation Need")).toBeVisible();
    await expect(page.getByText("Research Collaboration Track")).toBeVisible();
    await expect(page.getByText("Running evaluation pilots.")).toBeVisible();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
    await expect(page.getByText("Views", { exact: true })).toBeVisible();
    await expect(page.getByText("Likes", { exact: true })).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText("9", { exact: true })).toBeVisible();
    await expect(page.getByText("4", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("profile-domain-filter-hub_item"),
    ).toBeVisible();
    await expect(
      page.getByTestId("profile-domain-filter-enterprise_need"),
    ).toBeVisible();
    await expect(
      page.getByTestId("profile-domain-filter-research_project"),
    ).toBeVisible();

    await page.getByTestId("profile-domain-filter-research_project").click();
    await expect(page.getByTestId("profile-content-card-research-1")).toBeVisible();
    await expect(page.getByTestId("profile-content-card-need-1")).toHaveCount(0);
    await expect(
      page.getByTestId("profile-content-preview-research-1-neededSupport"),
    ).toContainText("Need benchmark instrumentation support.");

    await page.getByTestId("profile-domain-filter-enterprise_need").click();
    await expect(page.getByTestId("profile-content-card-need-1")).toBeVisible();
    await expect(
      page.getByTestId("profile-content-preview-need-1-background"),
    ).toContainText("Current workflow is fragmented across teams.");
    await expect(
      page.getByTestId("profile-content-preview-need-1-goal"),
    ).toContainText("Ship a reusable enterprise evaluation pilot.");

    expect(
      requests.some((url) => url.includes("/api/profiles/user-1/page")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes("/api/hub")),
    ).toBeFalsy();
    expect(
      requests.some(
        (url) =>
          url.includes("/api/profiles/user-1") &&
          !url.includes("/api/profiles/user-1/page"),
      ),
    ).toBeFalsy();
  });

  test("keeps public profile display consistent after editing profile settings", async ({
    page,
  }) => {
    await seedAuth(page, {
      ...USERS.learner,
      title: "Research Apprentice",
      bio: "Initial learner bio",
      location: "Shanghai",
      contactEmail: "learner-contact@example.com",
      whatImDoing: "Exploring evaluation workflows.",
      whatICanProvide: "Early-stage research ops support.",
      whatImLookingFor: "Hands-on AI product teams.",
    } as any);
    await installStrictApiMocking(page);

    const requests: string[] = [];
    const updatedUser = {
      id: USERS.learner.id,
      name: "Learner One Updated",
      email: USERS.learner.email,
      role: USERS.learner.role,
      avatar: "",
      title: "Evaluation Researcher",
      bio: "Updated learner bio for the public profile page.",
      location: "Singapore",
      company: "AI World Lab",
      contactEmail: "updated-contact@example.com",
      whatImDoing: "Running profile consistency checks.",
      whatICanProvide: "User research, testing, and delivery support.",
      whatImLookingFor: "Cross-functional AI product teams.",
      skills: ["Research", "Testing"],
      socialLinks: {},
      privacySettings: {
        emailVisibility: "PUBLIC",
      },
      onboardingDone: true,
    };

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

    await page.route("**/api/profiles/me", async (route) => {
      requests.push(route.request().url());
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updatedUser),
      });
    });

    await page.route(`**/api/profiles/${USERS.learner.id}/page`, async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: updatedUser,
          contents: [],
          summary: {
            publishedContentCount: 0,
            totalViews: 0,
            totalLikes: 0,
            featuredTypes: [],
            domainCounts: {
              hubItems: 0,
              enterpriseNeeds: 0,
              researchProjects: 0,
            },
          },
        }),
      });
    });

    await page.goto("/settings/profile");

    await page.getByTestId("profile-name-input").fill(updatedUser.name);
    await page.getByTestId("profile-title-input").fill(updatedUser.title);
    await page.getByTestId("profile-company-input").fill(updatedUser.company);
    await page.getByTestId("profile-location-input").fill(updatedUser.location);
    await page.getByTestId("profile-bio-input").fill(updatedUser.bio);
    await page
      .getByTestId("profile-contact-email-input")
      .fill(updatedUser.contactEmail);
    await page
      .getByTestId("profile-what-im-doing-input")
      .fill(updatedUser.whatImDoing);
    await page
      .getByTestId("profile-what-i-can-provide-input")
      .fill(updatedUser.whatICanProvide);
    await page
      .getByTestId("profile-what-im-looking-for-input")
      .fill(updatedUser.whatImLookingFor);
    await page.getByTestId("profile-save-top-btn").click();

    await page.goto(`/u/${USERS.learner.id}`);

    await expect(page.getByText(updatedUser.name)).toBeVisible();
    await expect(page.getByTestId("profile-direct-message")).toHaveCount(0);
    await expect(
      page.getByTestId("profile-contact-send-message"),
    ).toHaveCount(0);
    await expect(page.getByText(updatedUser.title)).toBeVisible();
    await expect(page.getByText(updatedUser.bio)).toBeVisible();
    await expect(page.getByText(updatedUser.location)).toBeVisible();
    await expect(page.getByText(updatedUser.contactEmail).first()).toBeVisible();
    await expect(page.getByText(updatedUser.whatImDoing)).toBeVisible();
    await expect(page.getByText(updatedUser.whatICanProvide)).toBeVisible();
    await expect(page.getByText(updatedUser.whatImLookingFor)).toBeVisible();

    expect(
      requests.some((url) => url.includes("/api/profiles/me")),
    ).toBeTruthy();
    expect(
      requests.some((url) => url.includes(`/api/profiles/${USERS.learner.id}/page`)),
    ).toBeTruthy();
  });
});
