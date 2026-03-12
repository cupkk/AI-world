import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockAssistantApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("assistant", () => {
  test("renders recommendation cards from the assistant API response", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);
    await mockAssistantApis(page, {
      result: {
        reply: "Expert One is a strong fit for your NLP question.",
        recommendedUserId: USERS.expert.id,
        recommendedContentId: "content-1",
      },
      recommendedUser: USERS.expert,
      recommendedContent: {
        id: "content-1",
        title: "NLP Systems Handbook",
        description: "A practical guide to NLP delivery.",
        type: "PAPER",
        status: "PUBLISHED",
        authorId: USERS.expert.id,
        createdAt: new Date().toISOString(),
        tags: ["NLP", "Systems"],
        likes: 12,
        views: 88,
      },
    });

    await page.goto("/assistant");
    await page.getByTestId("assistant-input").fill("Find me an NLP expert");
    await page.getByTestId("assistant-send-btn").click();

    await expect(
      page.getByTestId("assistant-message-assistant").filter({
        hasText: "Expert One is a strong fit for your NLP question.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View Profile" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View Details" }),
    ).toBeVisible();
  });

  test("shows an explicit unavailable state when the assistant service returns 503", async ({
    page,
  }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);
    await mockAssistantApis(page, {
      error: {
        status: 503,
        body: {
          code: 503,
          errorCode: "ASSISTANT_UNAVAILABLE",
          message: "Assistant service is temporarily unavailable.",
        },
      },
    });

    await page.goto("/assistant");
    await page.getByTestId("assistant-input").fill("Recommend a collaborator");
    await page.getByTestId("assistant-send-btn").click();

    await expect(page.getByTestId("assistant-error-banner")).toContainText(
      "Assistant service is temporarily unavailable.",
    );
    await expect(
      page.getByText(/local recommendation mode/i),
    ).toHaveCount(0);
  });
});
