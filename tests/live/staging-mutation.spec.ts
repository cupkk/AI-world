import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  allowLiveMutations,
  getLiveBaseUrl,
  getLiveCredentials,
  getMissingLiveCredentialsMessage,
} from "./helpers/env";
import { expectPostLogin, liveLogin } from "./helpers/session";

const admin = getLiveCredentials("ADMIN");
const baseUrl = getLiveBaseUrl();
const canMutate = allowLiveMutations();
const missingCredentialMessages = [
  !admin ? getMissingLiveCredentialsMessage("ADMIN") : null,
].filter((message): message is string => Boolean(message));
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const contentTitle = `staging-live-${runId}`;
const contentDescription = "Created by Playwright live mutation smoke.";
const kbFileName = `staging-live-${runId}.pdf`;
const kbPdfBuffer = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
);
const mutationLearnerPassword = "Learner@2026!";
const mutationLearnerInviteCode = "AIWORLD-LEARNER-2026";

type MutationLearner = {
  email: string;
  password: string;
};

let mutationLearner: MutationLearner | null = null;

function getMutationLearnerEmail() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `staging.mutation.${runId}.${suffix}@aiworld.dev`;
}

async function ensureMutationLearner(
  request: APIRequestContext,
): Promise<MutationLearner> {
  if (mutationLearner) {
    return mutationLearner;
  }

  const learner = {
    email: getMutationLearnerEmail(),
    password: mutationLearnerPassword,
  };

  const response = await request.post(new URL("/api/auth/register", baseUrl).toString(), {
    data: {
      displayName: `Staging Mutation ${runId}`,
      email: learner.email,
      password: learner.password,
      phone: "13800138000",
      inviteCode: mutationLearnerInviteCode,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to create staging mutation learner (${response.status()}): ${await response.text()}`,
    );
  }

  mutationLearner = learner;
  return learner;
}

test.describe.serial("staging live mutation regression", () => {
  test.skip(
    !canMutate,
    `Set LIVE_ALLOW_MUTATIONS=1 and use a non-production PLAYWRIGHT_BASE_URL before running mutation smoke. Current base URL: ${baseUrl}`,
  );
  test.skip(
    missingCredentialMessages.length > 0,
    missingCredentialMessages.join("; "),
  );

  test.beforeAll(async ({ request }) => {
    await ensureMutationLearner(request);
  });

  test("learner can submit content for review through the real API", async ({
    page,
    request,
  }) => {
    const learner = await ensureMutationLearner(request);

    await liveLogin(page, learner.email, learner.password);
    await expectPostLogin(page);

    await page.goto("/publish");
    await page.getByTestId("publish-new-content-btn").click();
    await page.getByPlaceholder("Enter content title").fill(contentTitle);
    await page
      .getByPlaceholder("Write your content here...")
      .fill(contentDescription);
    await page.getByPlaceholder(/e\.g\., AI/i).fill("AI,staging,playwright");

    const createDraftResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/publish" &&
        response.request().method() === "POST"
      );
    });
    const submitForReviewResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        /^\/api\/publish\/[^/]+\/submit$/.test(url.pathname) &&
        response.request().method() === "POST"
      );
    });

    await page.getByTestId("publish-submit-review-btn").click();
    const createDraftResponse = await createDraftResponsePromise;
    expect(createDraftResponse.ok()).toBeTruthy();
    const submitForReviewResponse = await submitForReviewResponsePromise;
    expect(submitForReviewResponse.ok()).toBeTruthy();

    await expect(
      page
        .getByTestId("publish-item-title")
        .filter({ hasText: contentTitle }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("learner can upload a knowledge base document through the real API", async ({
    page,
    request,
  }) => {
    const learner = await ensureMutationLearner(request);

    await liveLogin(page, learner.email, learner.password);
    await expectPostLogin(page);

    await page.goto("/settings/knowledge-base");
    const uploadResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/knowledge-base/upload" &&
        response.request().method() === "POST"
      );
    });
    await page.locator('input[type="file"]').setInputFiles({
      name: kbFileName,
      mimeType: "application/pdf",
      buffer: kbPdfBuffer,
    });
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.ok()).toBeTruthy();
    const uploadPayload = await uploadResponse.json();
    const uploadedFileName =
      typeof uploadPayload?.data?.name === "string"
        ? uploadPayload.data.name
        : kbFileName;

    await expect
      .poll(
        async () => {
          return page.evaluate(async (expectedName) => {
            const response = await fetch("/api/knowledge-base", {
              credentials: "include",
            });
            const payload = await response.json();
            const items = Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.data)
                ? payload.data
                : [];

            return items.some((item: any) => item?.name === expectedName) ? 1 : 0;
          }, uploadedFileName);
        },
        {
          timeout: 20_000,
          intervals: [1_000, 2_000, 3_000],
        },
      )
      .toBeGreaterThan(0);
  });

  test("learner can get a real assistant recommendation", async ({
    page,
    request,
  }) => {
    const learner = await ensureMutationLearner(request);

    await liveLogin(page, learner.email, learner.password);
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
