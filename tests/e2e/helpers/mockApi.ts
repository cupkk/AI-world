import type { Page } from "@playwright/test";
import type { TestUser } from "./auth";
import { DEFAULT_PUBLIC_INVITE_SAMPLES } from "../../../src/lib/inviteSamples";

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

  await page.route("**/api/applications/outbox", async (route) => {
    await route.fulfill(json([]));
  });
}

export async function mockInviteApis(
  page: Page,
  {
    samples = DEFAULT_PUBLIC_INVITE_SAMPLES,
  }: {
    samples?: Array<{ code: string; role: string }>;
  } = {},
) {
  await page.route("**/api/auth/invite/samples", async (route) => {
    await route.fulfill(json(samples));
  });

  await page.route("**/api/auth/invite/verify", async (route) => {
    const body = route.request().postDataJSON() as { code?: string } | undefined;
    const normalizedCode = String(body?.code ?? "").trim().toUpperCase();
    const match = samples.find((item) => item.code.toUpperCase() === normalizedCode);

    if (!match) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: 400, message: "Invalid invite code" }),
      });
      return;
    }

    await route.fulfill(
      json({
        id: `public_sample-${normalizedCode}`,
        code: normalizedCode,
        role: match.role,
        status: "UNUSED",
        createdAt: new Date("2026-03-13T00:00:00.000Z").toISOString(),
      }),
    );
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

  await page.route("**/api/applications/outbox", async (route) => {
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

  let currentContent = { ...content };

  await page.route("**/api/publish/mine", async (route) => {
    await route.fulfill(json([currentContent]));
  });

  await page.route(`**/api/hub/${String(content.id)}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(json(currentContent));
      return;
    }

    await route.fallback();
  });

  await page.route(`**/api/publish/${String(content.id)}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      currentContent = {
        ...currentContent,
        ...body,
        description:
          typeof body?.description === "string"
            ? body.description
            : currentContent.description,
        status: "REJECTED",
      };
      await route.fulfill(json(currentContent));
      return;
    }

    await route.fallback();
  });

  await page.route(`**/api/publish/${String(content.id)}/draft`, async (route) => {
    currentContent = {
      ...currentContent,
      status: "DRAFT",
      rejectReason: null,
    };
    await route.fulfill(json(currentContent));
  });

  await page.route(`**/api/publish/${String(content.id)}/submit`, async (route) => {
    currentContent = { ...submitted };
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
  const allAuthors = [...derivedAuthors, ...authors];
  const authorsById = new Map(
    allAuthors.map((item) => [String(item.id ?? ""), item] as const),
  );

  await mockShellApis(page, { users: allAuthors });

  const dashboardReviewItems = reviewItems.map((item) => {
    const authorId = String(item.authorId ?? "");
    const author = authorId ? authorsById.get(authorId) : undefined;

    return {
      ...item,
      author: author
        ? normalizeMockUser(authorId, author)
        : authorId
          ? normalizeMockUser(authorId)
          : undefined,
    };
  });

  const dashboardReports = reports.map((item) => {
    const reporterId = String(item.reporterId ?? "");
    const reporter = reporterId ? authorsById.get(reporterId) : undefined;
    const normalizedReporter =
      reporterId && reporter
        ? normalizeMockUser(reporterId, reporter)
        : reporterId
          ? normalizeMockUser(reporterId)
          : undefined;

    return {
      ...item,
      reporter: normalizedReporter,
      reporterName:
        typeof item.reporterName === "string"
          ? item.reporterName
          : normalizedReporter?.name ?? "",
    };
  });

  await page.route("**/api/admin/dashboard", async (route) => {
    await route.fulfill(
      json({
        stats: {
          pendingReviewCount: dashboardReviewItems.length,
          pendingReportCount: dashboardReports.filter(
            (item) => String(item.status ?? "PENDING") === "PENDING",
          ).length,
        },
        reviewItems: dashboardReviewItems,
        reports: dashboardReports,
      }),
    );
  });

  await page.route("**/api/admin/review", async (route) => {
    await route.fulfill(json(reviewItems));
  });

  await page.route("**/api/admin/reports", async (route) => {
    await route.fulfill(json(dashboardReports));
  });

  await page.route("**/api/admin/reports/*", async (route) => {
    await route.fulfill(json({}));
  });

  await page.route("**/api/admin/review/*/approve", async (route) => {
    await route.fulfill(json({}));
  });

  await page.route("**/api/admin/review/*/reject", async (route) => {
    await route.fulfill(json({}));
  });
}

export async function mockAdminHubApis(
  page: Page,
  {
    items,
    onUpdateHubItem,
  }: {
    items: Array<MockContent & { author?: MockUser }>;
    onUpdateHubItem?: (contentId: string, body: Record<string, unknown>) => void;
  },
) {
  const currentItems = items.map((item) => ({ ...item }));

  const matchesContentQuery = (
    item: MockContent & { author?: MockUser },
    {
      q,
      status,
      type,
    }: {
      q?: string;
      status?: string;
      type?: string;
    },
  ) => {
    const normalizedQuery = q?.trim().toLowerCase();
    const title = String(item.title ?? "").toLowerCase();
    const description = String(item.description ?? "").toLowerCase();
    const authorName = String(item.author?.name ?? "").toLowerCase();
    const authorEmail = String(item.author?.email ?? "").toLowerCase();
    const tags = Array.isArray(item.tags)
      ? item.tags.map((tag) => String(tag).toLowerCase())
      : [];

    const matchesQuery =
      !normalizedQuery ||
      title.includes(normalizedQuery) ||
      description.includes(normalizedQuery) ||
      authorName.includes(normalizedQuery) ||
      authorEmail.includes(normalizedQuery) ||
      tags.some((tag) => tag.includes(normalizedQuery));

    const matchesType = !type || String(item.type ?? "") === type;
    const matchesStatus = !status || String(item.status ?? "") === status;

    return matchesQuery && matchesType && matchesStatus;
  };

  const buildStats = (baseItems: Array<MockContent & { author?: MockUser }>) => ({
    publishedCount: baseItems.filter(
      (item) => String(item.status ?? "") === "PUBLISHED",
    ).length,
    pendingReviewCount: baseItems.filter(
      (item) => String(item.status ?? "") === "PENDING_REVIEW",
    ).length,
    draftCount: baseItems.filter(
      (item) => String(item.status ?? "") === "DRAFT",
    ).length,
    rejectedCount: baseItems.filter(
      (item) => String(item.status ?? "") === "REJECTED",
    ).length,
  });

  const buildResponse = (matchedItem: MockContent) => ({
    item: matchedItem,
    stats: buildStats(currentItems),
  });

  await mockShellApis(page, {
    users: currentItems
      .map((item) => item.author)
      .filter((item): item is MockUser => Boolean(item)),
  });

  await page.route("**/api/admin/content-management**", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const baseItems = currentItems.filter((item) =>
      matchesContentQuery(item, { q, type }),
    );
    const filteredItems = baseItems.filter((item) =>
      matchesContentQuery(item, { q, type, status }),
    );

    await route.fulfill(
      json({
        stats: buildStats(baseItems),
        items: filteredItems,
      }),
    );
  });

  await page.route("**/api/admin/content-management/*/approve", async (route) => {
    const contentId = route.request().url().split("/").slice(-2, -1)[0] ?? "";
    onUpdateHubItem?.(contentId, { status: "published" });
    const matched = currentItems.find((item) => String(item.id ?? "") === contentId);
    if (matched) {
      matched.status = "PUBLISHED";
      matched.rejectReason = undefined;
    }
    await route.fulfill(json(buildResponse(matched ?? { id: contentId, status: "PUBLISHED" })));
  });

  await page.route("**/api/admin/content-management/*/reject", async (route) => {
    const contentId = route.request().url().split("/").slice(-2, -1)[0] ?? "";
    const body = route.request().postDataJSON() as Record<string, unknown>;
    onUpdateHubItem?.(contentId, body);
    const matched = currentItems.find((item) => String(item.id ?? "") === contentId);
    if (matched) {
      matched.status = "REJECTED";
      matched.rejectReason =
        typeof body?.reason === "string" ? body.reason : matched.rejectReason;
    }
    await route.fulfill(
      json(
        buildResponse(
          matched ?? {
            id: contentId,
            status: "REJECTED",
            rejectReason: typeof body?.reason === "string" ? body.reason : undefined,
          },
        ),
      ),
    );
  });

  await page.route("**/api/admin/content-management/*/draft", async (route) => {
    const contentId = route.request().url().split("/").slice(-2, -1)[0] ?? "";
    onUpdateHubItem?.(contentId, { status: "draft" });
    const matched = currentItems.find((item) => String(item.id ?? "") === contentId);
    if (matched) {
      matched.status = "DRAFT";
    }
    await route.fulfill(json(buildResponse(matched ?? { id: contentId, status: "DRAFT" })));
  });

  await page.route("**/api/admin/content-management/*", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/batch")) {
      await route.fallback();
      return;
    }

    const contentId = getUserIdFromUrl(route.request().url());
    const body = route.request().postDataJSON() as Record<string, unknown>;
    onUpdateHubItem?.(contentId, body);

    const matched = currentItems.find((item) => String(item.id ?? "") === contentId);
    if (matched) {
      if (typeof body?.title === "string") {
        matched.title = body.title;
      }
      if (typeof body?.description === "string") {
        matched.description = body.description;
      }
      if (body?.status === "draft") {
        matched.status = "DRAFT";
      }
      if (body?.status === "published") {
        matched.status = "PUBLISHED";
        matched.rejectReason = undefined;
      }
    }

    await route.fulfill(
      json(
        buildResponse(
          matched ?? {
            id: contentId,
            ...body,
            description:
              typeof body?.description === "string" ? body.description : undefined,
          },
        ),
      ),
    );
  });

  await page.route("**/api/admin/content-management/batch", async (route) => {
    const body = route.request().postDataJSON() as {
      ids?: string[];
      action?: "approve" | "reject" | "draft";
      reason?: string;
    };
    const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id)) : [];

    ids.forEach((contentId) => {
      if (body?.action === "approve") {
        onUpdateHubItem?.(contentId, { status: "published" });
      } else if (body?.action === "draft") {
        onUpdateHubItem?.(contentId, { status: "draft" });
      } else if (body?.action === "reject") {
        onUpdateHubItem?.(contentId, { reason: body.reason ?? "", status: "rejected" });
      }

      const matched = currentItems.find((item) => String(item.id ?? "") === contentId);
      if (!matched) {
        return;
      }

      if (body?.action === "approve") {
        matched.status = "PUBLISHED";
        matched.rejectReason = undefined;
      } else if (body?.action === "draft") {
        matched.status = "DRAFT";
      } else if (body?.action === "reject") {
        matched.status = "REJECTED";
        matched.rejectReason =
          typeof body?.reason === "string" ? body.reason : matched.rejectReason;
      }
    });

    await route.fulfill(
      json({
        items: currentItems.filter((item) => ids.includes(String(item.id ?? ""))),
        updatedIds: ids,
        stats: buildStats(currentItems),
      }),
    );
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

  await page.route("**/api/enterprise/dashboard", async (route) => {
    await route.fulfill(
      json({
        profile: {
          aiStrategy: enterpriseProfile.aiStrategyText ?? "",
          whatImDoing: enterpriseProfile.casesText ?? "",
          whatImLookingFor: enterpriseProfile.achievementsText ?? "",
        },
        stats: {
          recommendedExpertsCount: talent.length,
          activeConversationsCount: conversations.length,
          postedNeedsCount: myContents.length,
          pendingInboundApplicationsCount: myApplications.filter(
            (item) => String(item.status ?? "") === "SUBMITTED",
          ).length,
        },
        recommendedExperts: talent,
        myContents,
        inboundApplications: myApplications,
      }),
    );
  });

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

  await page.route("**/api/applications/outbox", async (route) => {
    await route.fulfill(json(myApplications));
  });

  await page.route("**/api/hub**", async (route) => {
    await route.fulfill(json(hubItems));
  });
}

export async function mockExpertDashboardApis(
  page: Page,
  {
    myContents = [],
    collaborationOpportunities = [],
    inboundApplications = [],
    enterpriseConnections = [],
    onApplicationStatusUpdate,
  }: {
    myContents?: MockContent[];
    collaborationOpportunities?: Array<MockContent & { author?: MockUser }>;
    inboundApplications?: Array<MockContent & { applicant?: MockUser; targetContentTitle?: string }>;
    enterpriseConnections?: MockUser[];
    onApplicationStatusUpdate?: (appId: string, body: Record<string, string>) => void;
  },
) {
  await mockShellApis(page, {
    users: [
      ...enterpriseConnections,
      ...collaborationOpportunities
        .map((item) => item.author)
        .filter((item): item is MockUser => Boolean(item)),
      ...inboundApplications
        .map((item) => item.applicant)
        .filter((item): item is MockUser => Boolean(item)),
    ],
  });

  await page.route("**/api/expert/dashboard", async (route) => {
    await route.fulfill(
      json({
        stats: {
          totalContentCount: myContents.length,
          totalViews: myContents.reduce((sum, item) => sum + Number(item.views ?? 0), 0),
          totalLikes: myContents.reduce((sum, item) => sum + Number(item.likes ?? 0), 0),
          pendingApplicantCount: inboundApplications.filter(
            (item) => String(item.status ?? "") === "SUBMITTED",
          ).length,
        },
        myContents,
        collaborationOpportunities,
        inboundApplications,
        enterpriseConnections,
      }),
    );
  });

  await page.route("**/api/applications/*", async (route) => {
    const appId = getUserIdFromUrl(route.request().url());
    const body = route.request().postDataJSON() as Record<string, string>;
    onApplicationStatusUpdate?.(appId, body);
    await route.fulfill(json({}));
  });
}

export async function mockLearnerDashboardApis(
  page: Page,
  {
    dashboard,
    onSubmitApplication,
  }: {
    dashboard: {
      stats: {
        publishedContentCount: number;
        availableContentCount: number;
        pendingReviewCount: number;
        applicationCount: number;
      };
      learningResources: MockContent[];
      projectOpportunities: MockContent[];
      recommendedContents: MockContent[];
      myContents: MockContent[];
      applications: MockContent[];
    };
    onSubmitApplication?: (body: Record<string, unknown>) => void;
  },
) {
  await mockShellApis(page);

  await page.route("**/api/learner/dashboard", async (route) => {
    await route.fulfill(json(dashboard));
  });

  await page.route("**/api/applications", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as Record<string, unknown>;
    onSubmitApplication?.(body);

    await route.fulfill(
      json({
        id: "application-created-1",
        applicantId: "u-learner-1",
        targetType: body.targetType ?? "hub_project",
        targetId: body.targetId ?? "",
        message: body.message,
        status: "submitted",
        createdAt: new Date("2026-03-14T12:00:00.000Z").toISOString(),
      }),
    );
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
