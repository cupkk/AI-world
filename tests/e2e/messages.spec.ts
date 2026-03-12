import { expect, test } from "@playwright/test";
import { seedAuth, USERS } from "./helpers/auth";
import { mockMessageApis } from "./helpers/mockApi";
import { installStrictApiMocking } from "./helpers/strictApi";

test.describe("messages", () => {
  test("sends a message inside an accepted conversation", async ({ page }) => {
    await seedAuth(page, USERS.learner);
    await installStrictApiMocking(page);
    await mockMessageApis(page, {
      conversations: [
        {
          id: "thread-1",
          participants: [
            { ...USERS.learner },
            {
              id: USERS.expert.id,
              name: USERS.expert.name,
              email: USERS.expert.email,
              role: USERS.expert.role,
              avatar: "",
            },
          ],
          unreadCount: 0,
          status: "ACCEPTED",
          initiatorId: USERS.learner.id,
          lastMessage: {
            id: "m-init",
            senderId: USERS.expert.id,
            receiverId: USERS.learner.id,
            content: "hello",
            createdAt: new Date().toISOString(),
            read: true,
          },
        },
      ],
      requests: [],
      messagesByThread: {
        "thread-1": [
          {
            id: "m-init",
            senderId: USERS.expert.id,
            receiverId: USERS.learner.id,
            content: "hello",
            createdAt: new Date().toISOString(),
            read: true,
          },
        ],
      },
      sentMessagesByThread: {
        "thread-1": {
          id: "m-sent",
          senderId: USERS.learner.id,
          receiverId: USERS.expert.id,
          content: "Automated message",
          createdAt: new Date().toISOString(),
          read: false,
        },
      },
    });

    await page.goto("/messages");
    await page.getByTestId("thread-item-thread-1").click();
    await expect(page.getByTestId("message-input")).toBeVisible();

    await page.getByTestId("message-input").fill("Automated message");
    await page.keyboard.press("Enter");

    await expect(
      page
        .getByTestId("message-content")
        .filter({ hasText: "Automated message" })
        .first(),
    ).toBeVisible();
  });
});
