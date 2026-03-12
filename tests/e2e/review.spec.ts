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
    });

    await page.goto("/admin/review");
    await expect(
      page.getByRole("heading", { name: "Pending Paper" }),
    ).toBeVisible();

    await page.getByTestId("review-approve-pending-1").click();

    await expect(
      page.getByRole("heading", { name: "Pending Paper" }),
    ).not.toBeVisible();
  });
});
