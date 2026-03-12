import { expect, test } from "@playwright/test";
import {
  allowLiveMutations,
  getLiveBaseUrl,
  getLiveCredentials,
  getMissingLiveCredentialsMessage,
} from "./helpers/env";
import { expectPostLogin, liveLogin } from "./helpers/session";

const learner = getLiveCredentials("LEARNER");
const admin = getLiveCredentials("ADMIN");
const baseUrl = getLiveBaseUrl();
const canMutate = allowLiveMutations();
const missingCredentialMessages = [
  !learner ? getMissingLiveCredentialsMessage("LEARNER") : null,
  !admin ? getMissingLiveCredentialsMessage("ADMIN") : null,
].filter((message): message is string => Boolean(message));
const contentTitle = `staging-live-${new Date()
  .toISOString()
  .replace(/[:.]/g, "-")}`;
const contentDescription = "Created by Playwright live mutation smoke.";
const kbFileName = `staging-live-${new Date()
  .toISOString()
  .replace(/[:.]/g, "-")}.pdf`;
const kbPdfBuffer = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
);

test.describe.serial("staging live mutation regression", () => {
  test.skip(
    !canMutate,
    `Set LIVE_ALLOW_MUTATIONS=1 and use a non-production PLAYWRIGHT_BASE_URL before running mutation smoke. Current base URL: ${baseUrl}`,
  );
  test.skip(
    missingCredentialMessages.length > 0,
    missingCredentialMessages.join("; "),
  );

  test("learner can submit content for review through the real API", async ({
    page,
  }) => {
    await liveLogin(page, learner!.email, learner!.password);
    await expectPostLogin(page);

    await page.goto("/publish");
    await page.getByTestId("publish-new-content-btn").click();
    await page.getByPlaceholder("Enter content title").fill(contentTitle);
    await page
      .getByPlaceholder("Write your content here...")
      .fill(contentDescription);
    await page.getByPlaceholder(/e\.g\., AI/i).fill("AI,staging,playwright");
    await page.getByTestId("publish-submit-review-btn").click();

    await expect(
      page
        .getByTestId("publish-item-title")
        .filter({ hasText: contentTitle }),
    ).toBeVisible();
  });

  test("learner can upload a knowledge base document through the real API", async ({
    page,
  }) => {
    await liveLogin(page, learner!.email, learner!.password);
    await expectPostLogin(page);

    await page.goto("/settings/knowledge-base");
    await page.locator('input[type="file"]').setInputFiles({
      name: kbFileName,
      mimeType: "application/pdf",
      buffer: kbPdfBuffer,
    });

    await expect(
      page.locator("p.font-medium.text-zinc-100", { hasText: kbFileName }).first(),
    ).toBeVisible();
  });

  test("learner can get a real assistant recommendation", async ({ page }) => {
    await liveLogin(page, learner!.email, learner!.password);
    await expectPostLogin(page);

    const assistantPrompt = "Find an NLP expert who can help with enterprise AI deployment.";

    await page.goto("/assistant");
    await page.getByTestId("assistant-input").fill(assistantPrompt);

    const responsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/assistant/recommend") &&
        response.request().method() === "POST"
      );
    });

    await page.getByTestId("assistant-send-btn").click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    await expect
      .poll(() => page.getByTestId("assistant-message-assistant").count())
      .toBeGreaterThan(1);
  });

  test("admin can find the staged submission in the review queue", async ({
    page,
  }) => {
    await liveLogin(page, admin!.email, admin!.password);
    await expectPostLogin(page);

    await expect
      .poll(
        async () => {
          await page.goto("/admin/review");
          return page.evaluate(async (expectedTitle) => {
            const response = await fetch("/api/admin/review", {
              credentials: "include",
            });
            const payload = await response.json();
            const items = Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.data)
                ? payload.data
                : [];

            return items.some(
              (item: any) =>
                item?.title === expectedTitle && item?.status === "PENDING_REVIEW",
            )
              ? 1
              : 0;
          }, contentTitle);
        },
        {
          timeout: 45_000,
          intervals: [1_000, 2_000, 3_000],
        },
      )
      .toBeGreaterThan(0);
  });
});
