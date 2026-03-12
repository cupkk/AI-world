import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import {
  mockPublishCreationApis,
  mockRejectedPublishApis,
} from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("publish", () => {
  test("creates a draft and submits it for review", async ({ page }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);
    await mockPublishCreationApis(page, {
      mine: [],
      created: {
        id: "content-1",
        title: "Test Publish Title",
        description: "Test Publish Description",
        type: "PAPER",
        status: "DRAFT",
        authorId: USERS.learner.id,
        createdAt: new Date().toISOString(),
        tags: ["AI"],
        likes: 0,
        views: 0,
        visibility: "ALL",
      },
      submitted: {
        id: "content-1",
        title: "Test Publish Title",
        description: "Test Publish Description",
        type: "PAPER",
        status: "PENDING_REVIEW",
        authorId: USERS.learner.id,
        createdAt: new Date().toISOString(),
        tags: ["AI"],
        likes: 0,
        views: 0,
        visibility: "ALL",
      },
    });

    await page.goto("/publish");
    await page.getByTestId("publish-new-content-btn").click();
    await page
      .getByPlaceholder("Enter content title")
      .fill("Test Publish Title");
    await page
      .getByPlaceholder("Write your content here...")
      .fill("Test Publish Description");
    await page.getByPlaceholder(/e\.g\., AI/i).fill("AI,Test");
    await page.getByTestId("publish-submit-review-btn").click();

    await expect(
      page
        .getByTestId("publish-item-title")
        .filter({ hasText: "Test Publish Title" }),
    ).toBeVisible();
    await expect(page.getByText(/My Submissions \(1\)/)).toBeVisible();
  });

  test("opens a rejected draft for revision", async ({ page }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    const rejectedContent = {
      id: "content-rejected",
      title: "Old Title",
      description: "Old Description",
      type: "PAPER",
      status: "REJECTED",
      authorId: USERS.learner.id,
      createdAt: new Date().toISOString(),
      tags: ["AI"],
      likes: 0,
      views: 0,
      rejectReason: "Needs more detail",
    };

    await mockRejectedPublishApis(page, {
      content: rejectedContent,
      submitted: {
        ...rejectedContent,
        title: "Updated Title",
        status: "PENDING_REVIEW",
        rejectReason: null,
      },
    });

    await page.goto("/publish");
    await expect(page.getByText("Old Title")).toBeVisible();
    await page.getByText("Old Title").click();
    await expect(page.getByText("Needs more detail")).toBeVisible();
  });
});
