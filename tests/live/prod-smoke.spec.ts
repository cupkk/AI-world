import { expect, test } from "@playwright/test";
import {
  getLiveCredentials,
  getMissingLiveCredentialsMessage,
} from "./helpers/env";
import { expectPostLogin, liveLogin } from "./helpers/session";

const admin = getLiveCredentials("ADMIN");
const learner = getLiveCredentials("LEARNER");
const expert = getLiveCredentials("EXPERT");
const enterprise = getLiveCredentials("ENTERPRISE");
const missingCredentialMessages = [
  !admin ? getMissingLiveCredentialsMessage("ADMIN") : null,
  !learner ? getMissingLiveCredentialsMessage("LEARNER") : null,
  !expert ? getMissingLiveCredentialsMessage("EXPERT") : null,
  !enterprise ? getMissingLiveCredentialsMessage("ENTERPRISE") : null,
].filter((message): message is string => Boolean(message));

test.describe("live smoke regression", () => {
  test.skip(
    missingCredentialMessages.length > 0,
    missingCredentialMessages.join("; "),
  );

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/hub");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin can log in and open the review dashboard", async ({ page }) => {
    await liveLogin(page, admin!.email, admin!.password);
    await expectPostLogin(page);

    await page.goto("/admin/review");
    await expect(
      page.getByText(/Admin Review Dashboard|Content Review/i).first(),
    ).toBeVisible();
  });

  test("learner can reach publish, assistant, and knowledge base", async ({
    page,
  }) => {
    await liveLogin(page, learner!.email, learner!.password);
    await expectPostLogin(page);

    await page.goto("/publish");
    await expect(page.getByTestId("publish-new-content-btn")).toBeVisible();

    await page.goto("/assistant");
    await expect(page.getByTestId("assistant-input")).toBeVisible();

    await page.goto("/settings/knowledge-base");
    await expect(page.getByText(/Knowledge Base/i).first()).toBeVisible();
    await expect(
      page.getByText(/Upload Document|Click or drag/i).first(),
    ).toBeVisible();
  });

  test("expert can reach messages", async ({ page }) => {
    await liveLogin(page, expert!.email, expert!.password);
    await expectPostLogin(page);

    await page.goto("/messages");
    await expect(page.getByText(/Messages/i).first()).toBeVisible();
  });

  test("enterprise leader can reach the enterprise dashboard", async ({
    page,
  }) => {
    await liveLogin(page, enterprise!.email, enterprise!.password);
    await expectPostLogin(page);

    await page.goto("/app/enterprise");
    await expect(
      page.getByRole("heading", { name: /Enterprise Dashboard/i }),
    ).toBeVisible();
  });
});
