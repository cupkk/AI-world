import { expect, test } from "@playwright/test";
import {
  getLiveCredentials,
  getMissingLiveCredentialsMessage,
  isLiveFeatureEnabled,
} from "./helpers/env";
import { expectPostLogin, liveLogin } from "./helpers/session";

const admin = getLiveCredentials("ADMIN");
const learner = getLiveCredentials("LEARNER");
const expert = getLiveCredentials("EXPERT");
const enterprise = getLiveCredentials("ENTERPRISE");
const assistantEnabled = isLiveFeatureEnabled("ASSISTANT");
const knowledgeBaseEnabled = isLiveFeatureEnabled("KNOWLEDGE_BASE");
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
      page
        .getByText(/Admin Review Dashboard|Content Review|内容审核|管理审核看板/i)
        .first(),
    ).toBeVisible();
  });

  test("learner can reach publish and respect sealed optional modules", async ({
    page,
  }) => {
    await liveLogin(page, learner!.email, learner!.password);
    await expectPostLogin(page);

    await page.goto("/publish");
    await expect(page.getByTestId("publish-new-content-btn")).toBeVisible();

    await page.goto("/assistant");
    if (assistantEnabled) {
      await expect(page.getByTestId("assistant-input")).toBeVisible();
    } else {
      await expect(page).not.toHaveURL(/\/assistant(?:\/|$)/);
      await expect(page.getByTestId("assistant-input")).toHaveCount(0);
    }

    await page.goto("/settings/knowledge-base");
    if (knowledgeBaseEnabled) {
      await expect(page.getByText(/Knowledge Base|知识库/i).first()).toBeVisible();
      await expect(
        page.getByText(/Upload Document|Click or drag|上传|点击或拖拽/i).first(),
      ).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/settings\/profile$/);
    }
  });

  test("expert can reach messages", async ({ page }) => {
    await liveLogin(page, expert!.email, expert!.password);
    await expectPostLogin(page);

    await page.goto("/messages");
    await expect(page.getByText(/Messages|消息/i).first()).toBeVisible();
  });

  test("enterprise leader can reach the enterprise dashboard", async ({
    page,
  }) => {
    await liveLogin(page, enterprise!.email, enterprise!.password);
    await expectPostLogin(page);

    await page.goto("/app/enterprise");
    await expect(
      page.getByRole("heading", { name: /Enterprise Dashboard|企业控制台/i }),
    ).toBeVisible();
  });
});
