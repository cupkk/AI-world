import { expect, test } from "@playwright/test";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("invite samples", () => {
  test("fills the input when selecting a sample invite code", async ({
    page,
  }) => {
    await installStrictApiMocking(page);
    await page.goto("/invite");

    await expect(page.getByTestId("invite-example-expert")).toBeVisible();
    await expect(page.getByTestId("invite-example-learner")).toBeVisible();
    await expect(
      page.getByTestId("invite-example-enterprise_leader"),
    ).toBeVisible();

    await page.getByTestId("invite-example-apply-learner").click();
    await expect(page.getByTestId("invite-code-input")).toHaveValue(
      "AIWORLD-LEARNER-EXAMPLE",
    );
  });

  test("does not expose demo launch actions on the invite page", async ({
    page,
  }) => {
    await installStrictApiMocking(page);
    await page.goto("/invite");

    await expect(page.getByTestId("invite-example-expert")).toBeVisible();
    await expect(
      page.getByTestId("invite-example-launch-expert"),
    ).toHaveCount(0);
  });
});
