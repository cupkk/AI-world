import type { Page } from "@playwright/test";
import type { TestUser } from "./auth";

type MockContent = Record<string, unknown>;
type MockThread = Record<string, unknown>;
type MockMessage = Record<string, unknown>;
type MockUser = Record<string, unknown>;

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function getThreadIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/");
  return parts[parts.length - 2] || "";
}

function getUserIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/");
  return parts[parts.length - 1] || "";
}

function normalizeMockUser(userId: string, user?: MockUser) {
  return {
    id: userId,
    name: typeof user?.name === "string" ? user.name : `User ${userId}`,
    email:
      typeof user?.email === "string" ? user.email : `${userId.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "user"}@example.com`,
    role: typeof user?.role === "string" ? user.role : "LEARNER",
    avatar: typeof user?.avatar === "string" ? user.avatar : "",
    ...user,
  };
}

async function mockShellApis(
  page: Page,
  {
    conversations = [],
    requests = [],
    users = [],
  }: {
    conversations?: MockThread[];
    requests?: MockThread[];
    users?: MockUser[];
  } = {},
) {
  await page.route("**/api/messages/conversations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(json(conversations));
      return;
    }

    await route.fulfill(json({}));
  });

  await page.route("**/api/messages/requests", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(json(requests));
      return;
    }

    await route.fulfill(json({}));
  });

  await page.route("**/api/users/*", async (route) => {
    const userId = getUserIdFromUrl(route.request().url());
    const matchedUser = users.find((item) => String(item.id ?? "") === userId);
    await route.fulfill(json(normalizeMockUser(userId, matchedUser)));
  });
}

export async function mockLoginApis(
  page: Page,
  user: TestUser,
  hubItems: MockContent[] = [],
) {
  await mockShellApis(page, { users: [user] });

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill(
      json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        onboardingDone: user.onboardingDone ?? true,
      }),
    );
  });

  await page.route("**/api/hub**", async (route) => {
    await route.fulfill(json(hubItems));
  });

  await page.route("**/api/publish/mine", async (route) => {
    await route.fulfill(json([]));
  });

  await page.route("**/api/applications/mine", async (route) => {
    await route.fulfill(json([]));
  });
}

export async function mockProtectedRouteApis(
  page: Page,
  {
    hubItems = [],
    myContents = [],
    myApplications = [],
  }: {
    hubItems?: MockContent[];
    myContents?: MockContent[];
    myApplications?: MockContent[];
  } = {},
) {
  await mockShellApis(page);

  await page.route("**/api/publish/mine", async (route) => {
    await route.fulfill(json(myContents));
  });

  await page.route("**/api/hub**", async (route) => {
    await route.fulfill(json(hubItems));
  });

  await page.route("**/api/applications/mine", async (route) => {
    await route.fulfill(json(myApplications));
  });
}

export async function mockPublishCreationApis(
  page: Page,
  {
    mine,
    created,
    submitted,
  }: {
    mine: MockContent[];
    created: MockContent;
    submitted: MockContent;
  },
) {
  await mockShellApis(page);

  await page.route("**/api/publish/mine", async (route) => {
    await route.fulfill(json(mine));
  });

  await page.route("**/api/publish", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill(json(created));
  });

  await page.route(`**/api/publish/${String(created.id)}/submit`, async (route) => {
    await route.fulfill(json(submitted));
  });
}

export async function mockRejectedPublishApis(
  page: Page,
  {
    content,
    submitted,
  }: {
    content: MockContent;
    submitted: MockContent;
  },
) {
  await mockShellApis(page);

  await page.route("**/api/publish/mine", async (route) => {
    await route.fulfill(json([content]));
  });

  await page.route(`**/api/hub/${String(content.id)}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(json(content));
      return;
    }

    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      await route.fulfill(json({ ...content, ...body, status: "REJECTED" }));
      return;
    }

    await route.fallback();
  });

  await page.route(`**/api/publish/${String(content.id)}/submit`, async (route) => {
    await route.fulfill(json(submitted));
  });
}

export async function mockMessageApis(
  page: Page,
  {
    conversations,
    requests = [],
    messagesByThread,
    sentMessagesByThread = {},
  }: {
    conversations: MockThread[];
    requests?: MockThread[];
    messagesByThread: Record<string, MockMessage[]>;
    sentMessagesByThread?: Record<string, MockMessage>;
  },
) {
  await mockShellApis(page, { conversations, requests });

  await page.route("**/api/messages/conversations/*/messages", async (route) => {
    const threadId = getThreadIdFromUrl(route.request().url());
    if (route.request().method() === "GET") {
      await route.fulfill(json(messagesByThread[threadId] ?? []));
      return;
    }

    await route.fulfill(json(sentMessagesByThread[threadId] ?? {}));
  });

  await page.route("**/api/messages/conversations/*/read", async (route) => {
    await route.fulfill(json({}));
  });
}

export async function mockAdminReviewApis(
  page: Page,
  {
    reviewItems,
    reports = [],
    authors = [],
  }: {
    reviewItems: MockContent[];
    reports?: MockContent[];
    authors?: MockUser[];
  },
) {
  const derivedAuthors = reviewItems
    .map((item) => {
      const authorId = String(item.authorId ?? "");
      if (!authorId) return null;
      return {
        id: authorId,
        name: typeof item.authorName === "string" ? item.authorName : `Author ${authorId}`,
        role: "LEARNER",
      };
    })
    .filter((item): item is MockUser => Boolean(item));

  await mockShellApis(page, { users: [...derivedAuthors, ...authors] });

  await page.route("**/api/admin/review", async (route) => {
    await route.fulfill(json(reviewItems));
  });

  await page.route("**/api/admin/reports", async (route) => {
    await route.fulfill(json(reports));
  });

  await page.route("**/api/admin/review/*/approve", async (route) => {
    await route.fulfill(json({}));
  });

  await page.route("**/api/admin/review/*/reject", async (route) => {
    await route.fulfill(json({}));
  });
}

export async function mockEnterpriseDashboardApis(
  page: Page,
  {
    enterpriseProfile,
    talent = [],
    myContents = [],
    conversations = [],
    requests = [],
    myApplications = [],
    hubItems = [],
    onProfileUpdate,
  }: {
    enterpriseProfile: Record<string, unknown>;
    talent?: MockUser[];
    myContents?: MockContent[];
    conversations?: MockThread[];
    requests?: MockThread[];
    myApplications?: MockContent[];
    hubItems?: MockContent[];
    onProfileUpdate?: (body: Record<string, string>) => void;
  },
) {
  await mockShellApis(page, { conversations, requests, users: talent });

  await page.route("**/api/enterprise/me", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(json(enterpriseProfile));
      return;
    }

    const body = route.request().postDataJSON() as Record<string, string>;
    onProfileUpdate?.(body);
    await route.fulfill(json({ userId: enterpriseProfile.userId, ...body }));
  });

  await page.route("**/api/talent**", async (route) => {
    await route.fulfill(json(talent));
  });

  await page.route("**/api/publish/mine", async (route) => {
    await route.fulfill(json(myContents));
  });

  await page.route("**/api/applications/mine", async (route) => {
    await route.fulfill(json(myApplications));
  });

  await page.route("**/api/hub**", async (route) => {
    await route.fulfill(json(hubItems));
  });
}

export async function mockAssistantApis(
  page: Page,
  {
    result,
    recommendedUser,
    recommendedContent,
    error,
  }: {
    result?: Record<string, unknown>;
    recommendedUser?: MockUser;
    recommendedContent?: MockContent;
    error?: {
      status: number;
      body: Record<string, unknown>;
    };
  },
) {
  await mockShellApis(page, {
    users: recommendedUser ? [recommendedUser] : [],
  });

  if (recommendedContent?.id) {
    await page.route(`**/api/hub/${String(recommendedContent.id)}`, async (route) => {
      await route.fulfill(json(recommendedContent));
    });
  }

  await page.route("**/api/assistant/recommend", async (route) => {
    if (error) {
      await route.fulfill({
        status: error.status,
        contentType: "application/json",
        body: JSON.stringify(error.body),
      });
      return;
    }

    await route.fulfill(json(result ?? {}));
  });
}
