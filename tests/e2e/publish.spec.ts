import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import {
  mockManagePublishedPublishApis,
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

  test("enterprise leader creates an enterprise need through the unified publish flow", async ({ page }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    let createBody: Record<string, unknown> | undefined;

    await mockPublishCreationApis(page, {
      mine: [],
      onCreate: (body) => {
        createBody = body;
      },
      created: {
        id: "need-1",
        title: "Evaluation rollout need",
        description: "Deliver an evaluation pack",
        type: "PROJECT",
        contentDomain: "ENTERPRISE_NEED",
        status: "DRAFT",
        authorId: USERS.enterprise.id,
        createdAt: new Date().toISOString(),
        tags: ["QA"],
        likes: 0,
        views: 0,
        background: "Need help from external experts",
        goal: "Launch an internal benchmark in Q2",
        deliverables: "Deliver an evaluation pack",
        visibility: "EXPERTS_LEARNERS",
      },
      submitted: {
        id: "need-1",
        title: "Evaluation rollout need",
        description: "Deliver an evaluation pack",
        type: "PROJECT",
        contentDomain: "ENTERPRISE_NEED",
        status: "PENDING_REVIEW",
        authorId: USERS.enterprise.id,
        createdAt: new Date().toISOString(),
        tags: ["QA"],
        likes: 0,
        views: 0,
        background: "Need help from external experts",
        goal: "Launch an internal benchmark in Q2",
        deliverables: "Deliver an evaluation pack",
        visibility: "EXPERTS_LEARNERS",
      },
    });

    await page.goto("/publish");
    await page.getByTestId("publish-new-content-btn").click();
    await page.getByTestId("publish-form-visibility-experts-radio").check();
    await page.getByTestId("publish-form-title-input").fill("Evaluation rollout need");
    await page.getByTestId("publish-form-description-input").fill("Deliver an evaluation pack");
    await page.getByTestId("publish-form-background-input").fill("Need help from external experts");
    await page.getByTestId("publish-form-goal-input").fill("Launch an internal benchmark in Q2");
    await page.getByPlaceholder(/e\.g\., AI/i).fill("QA");
    await page.getByTestId("publish-submit-review-btn").click();

    expect(createBody).toMatchObject({
      title: "Evaluation rollout need",
      description: "Deliver an evaluation pack",
      type: "PROJECT",
      background: "Need help from external experts",
      goal: "Launch an internal benchmark in Q2",
      deliverables: "Deliver an evaluation pack",
      visibility: "experts_and_learners",
    });
    await expect(page.getByText(/My Submissions \(1\)/)).toBeVisible();
    await expect(page.getByText("Enterprise Need")).toBeVisible();
    await expect(
      page.getByTestId("publish-item-preview-need-1-background"),
    ).toContainText("Need help from external experts");
    await expect(
      page.getByTestId("publish-item-preview-need-1-goal"),
    ).toContainText("Launch an internal benchmark in Q2");
  });

  test("revises a rejected draft and re-submits it", async ({ page }) => {
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
    await expect(
      page.getByTestId("publish-detail-section-summary"),
    ).toContainText("Old Description");

    await page.getByTestId("publish-detail-edit-btn").click();
    await page.getByTestId("publish-detail-title-input").fill("Updated Title");
    await page.getByTestId("publish-detail-save-btn").click();
    await expect(page.getByRole("heading", { name: "Updated Title" })).toBeVisible();

    await page.getByTestId("publish-detail-save-draft-btn").click();
    await page.getByTestId("publish-detail-submit-btn").click();

    await expect(page.getByText("Needs more detail")).not.toBeVisible();
  });

  test("revises a rejected enterprise need and re-submits it", async ({ page }) => {
    await seedAuth(page, USERS.enterprise);
    await installStrictApiMocking(page);

    let updateBody: Record<string, unknown> | undefined;

    const rejectedNeed = {
      id: "need-rejected",
      title: "Old Need",
      description: "Old deliverables",
      type: "PROJECT",
      contentDomain: "ENTERPRISE_NEED",
      status: "REJECTED",
      authorId: USERS.enterprise.id,
      createdAt: new Date().toISOString(),
      tags: ["QA"],
      likes: 0,
      views: 0,
      background: "Old background",
      goal: "Old goal",
      deliverables: "Old deliverables",
      visibility: "EXPERTS_LEARNERS",
      rejectReason: "Needs more detail",
    };

    await mockRejectedPublishApis(page, {
      content: rejectedNeed,
      onUpdate: (body) => {
        updateBody = body;
      },
      submitted: {
        ...rejectedNeed,
        title: "Updated Need",
        description: "Updated deliverables",
        background: "Updated background",
        goal: "Updated goal",
        deliverables: "Updated deliverables",
        status: "PENDING_REVIEW",
        rejectReason: null,
      },
    });

    await page.goto("/publish");
    await expect(page.getByText("Old Need")).toBeVisible();
    await page.getByText("Old Need").click();
    await expect(page.getByText("Needs more detail")).toBeVisible();
    await expect(
      page.getByTestId("publish-detail-section-background"),
    ).toContainText("Old background");
    await expect(
      page.getByTestId("publish-detail-section-goal"),
    ).toContainText("Old goal");
    await expect(
      page.getByTestId("publish-detail-section-deliverables"),
    ).toContainText("Old deliverables");

    await page.getByTestId("publish-detail-edit-btn").click();
    await page.getByTestId("publish-detail-title-input").fill("Updated Need");
    await page.getByTestId("publish-detail-background-input").fill("Updated background");
    await page.getByTestId("publish-detail-goal-input").fill("Updated goal");
    await page.getByTestId("publish-detail-deliverables-input").fill("Updated deliverables");
    await page.getByTestId("publish-detail-save-btn").click();

    expect(updateBody).toMatchObject({
      title: "Updated Need",
      background: "Updated background",
      goal: "Updated goal",
      deliverables: "Updated deliverables",
    });
    await expect(page.getByRole("heading", { name: "Updated Need" })).toBeVisible();

    await page.getByTestId("publish-detail-save-draft-btn").click();
    await page.getByTestId("publish-detail-submit-btn").click();

    await expect(page.getByText("Needs more detail")).not.toBeVisible();
  });

  test("allows authors to edit and delete their published content", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);

    await mockManagePublishedPublishApis(page, {
      content: {
        id: "content-published",
        title: "Published Title",
        description: "Published Description",
        type: "PAPER",
        status: "PUBLISHED",
        authorId: USERS.learner.id,
        createdAt: new Date().toISOString(),
        tags: ["AI"],
        likes: 3,
        views: 7,
      },
    });

    await page.goto("/publish");
    await expect(
      page.getByTestId("publish-item-edit-content-published"),
    ).toBeVisible();
    await expect(
      page.getByTestId("publish-item-delete-content-published"),
    ).toBeVisible();

    await page.getByTestId("publish-item-edit-content-published").click();
    await expect(page.getByTestId("publish-detail-edit-btn")).toBeVisible();
    await page.getByTestId("publish-detail-edit-btn").click();
    await page.getByTestId("publish-detail-title-input").fill("Updated Published Title");
    await page.getByTestId("publish-detail-save-btn").click();
    await expect(
      page.getByRole("heading", { name: "Updated Published Title" }),
    ).toBeVisible();

    await page.goto("/publish");
    await expect(
      page
        .getByTestId("publish-item-title")
        .filter({ hasText: "Updated Published Title" }),
    ).toBeVisible();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId("publish-item-delete-content-published").click();
    await expect(
      page.getByTestId("publish-item-delete-content-published"),
    ).toHaveCount(0);
  });
});
