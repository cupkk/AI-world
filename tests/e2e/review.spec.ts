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
          title: "Pending Paper",
          description: "Need admin review",
          type: "PAPER",
          status: "PENDING_REVIEW",
          authorId: "author-1",
          createdAt: new Date().toISOString(),
          tags: ["AI"],
          likes: 0,
          views: 0,
          visibility: "ALL",
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
      page.getByRole("heading", { name: "Pending Paper" }),
    ).toBeVisible();
    await expect(page.getByText("Author One")).toBeVisible();

    await page.getByTestId("review-approve-pending-1").click();

    await expect(
      page.getByRole("heading", { name: "Pending Paper" }),
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
});
