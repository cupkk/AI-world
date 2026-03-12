type AssistantHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

import type {
  Application,
  ApplicationStatus,
  ApplicationTargetType,
  ChatThread,
  Content,
  InviteCode,
  InviteStatus,
  KnowledgeDocument,
  Message,
  PublicInviteSample,
  Role,
  ThreadStatus,
  User,
} from "../types";
import {
  normalizeApplicationStatusValue,
  normalizeApplicationTargetTypeValue,
  normalizeContentStatusValue,
  normalizeContentTypeValue,
  normalizeContentVisibilityValue,
  normalizeDocumentStatusValue,
  normalizeInviteStatusValue,
  normalizeRoleValue,
  normalizeThreadStatusValue,
  toBackendApplicationTargetTypeValue,
  toBackendContentVisibilityValue,
  toBackendEmailVisibilityValue,
} from "./contracts";
import { normalizeEmailVisibility } from "./utils";

type ApiEnvelope<T> = {
  data?: T;
} & T;

export type AssistantRecommendPayload = {
  query: string;
  userId?: string;
  locale?: string;
  history?: AssistantHistoryItem[];
};

export type AssistantRecommendResult = {
  reply?: string;
  recommendedUserId?: string;
  recommendedContentId?: string;
};

export type KnowledgeBaseUploadResult = {
  id?: string;
  name?: string;
  size?: number;
  type?: string;
  status?: "PROCESSING" | "READY" | "FAILED";
  errorMessage?: string;
  uploadedAt?: string;
};

type ApiErrorDetails = {
  message: string;
  code: number;
  errorCode?: string;
  details?: string[];
};

export class ApiError extends Error {
  code?: number;
  errorCode?: string;
  details?: string[];

  constructor({ message, code, errorCode, details }: ApiErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function getApiPath(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Read XSRF-TOKEN cookie for CSRF double-submit pattern */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Thin wrapper around fetch that always sends cookies (credentials: 'include') */
function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const csrfToken = getCsrfToken();
  if (csrfToken && init?.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method.toUpperCase())) {
    headers.set('X-XSRF-TOKEN', csrfToken);
  }
  return fetch(input, { credentials: "include", ...init, headers });
}

/** Parse error message from a non-ok response */
async function parseApiError(response: Response, fallbackLabel: string): Promise<string> {
  try {
    const body = await response.json();
    const msg = body?.message ?? body?.error ?? body?.data?.message;
    if (typeof msg === "string" && msg.length > 0) return msg;
    if (Array.isArray(msg)) return msg.join("; ");
  } catch {
    /* body not JSON — ignore */
  }
  return `${fallbackLabel} failed: ${response.status}`;
}

async function parseApiErrorDetails(
  response: Response,
  fallbackLabel: string,
): Promise<ApiErrorDetails> {
  try {
    const body = await response.json();
    const msg = body?.message ?? body?.error ?? body?.data?.message;
    const details = Array.isArray(msg)
      ? msg.filter((item: unknown): item is string => typeof item === "string")
      : undefined;
    const message =
      typeof msg === "string" && msg.length > 0
        ? msg
        : details && details.length > 0
          ? details.join("; ")
          : `${fallbackLabel} failed: ${response.status}`;

    return {
      message,
      code: typeof body?.code === "number" ? body.code : response.status,
      errorCode: typeof body?.errorCode === "string" ? body.errorCode : undefined,
      details,
    };
  } catch {
    return {
      message: `${fallbackLabel} failed: ${response.status}`,
      code: response.status,
    };
  }
}

function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  return [];
}

function unwrap<T>(raw: ApiEnvelope<T> | T): T {
  if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    return (raw as ApiEnvelope<T>).data as T;
  }
  return raw as T;
}

function normalizeRole(role: unknown): Role {
  return normalizeRoleValue(role);
}

function normalizeUser(raw: any): User {
  const rawEmailVisibility =
    raw?.privacySettings?.emailVisibility ??
    raw?.emailVisibility;

  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? ""),
    email: String(raw?.email ?? ""),
    role: normalizeRole(raw?.role),
    avatar: String(raw?.avatar ?? raw?.avatarUrl ?? ""),
    bio: typeof raw?.bio === "string" ? raw.bio : undefined,
    skills: Array.isArray(raw?.skills) ? raw.skills.filter((item: unknown) => typeof item === "string") : undefined,
    company: typeof raw?.company === "string" ? raw.company : undefined,
    title: typeof raw?.title === "string" ? raw.title : undefined,
    location: typeof raw?.location === "string" ? raw.location : undefined,
    contactEmail: typeof raw?.contactEmail === "string" ? raw.contactEmail : undefined,
    socialLinks: typeof raw?.socialLinks === "object" && raw?.socialLinks ? raw.socialLinks : undefined,
    privacySettings: rawEmailVisibility
      ? { emailVisibility: normalizeEmailVisibility(rawEmailVisibility) }
      : undefined,
    whatImDoing: typeof raw?.whatImDoing === "string" ? raw.whatImDoing : undefined,
    whatICanProvide: typeof raw?.whatICanProvide === "string" ? raw.whatICanProvide : undefined,
    whatImLookingFor: typeof raw?.whatImLookingFor === "string" ? raw.whatImLookingFor : undefined,
    aiStrategy: typeof raw?.aiStrategy === "string" ? raw.aiStrategy : undefined,
    blockedUsers: Array.isArray(raw?.blockedUsers)
      ? raw.blockedUsers.filter((item: unknown) => typeof item === "string")
      : undefined,
    // Onboarding fields
    phone: typeof raw?.phone === "string" ? raw.phone : undefined,
    phonePublic: typeof raw?.phonePublic === "boolean" ? raw.phonePublic : undefined,
    companyName: typeof raw?.companyName === "string" ? raw.companyName : undefined,
    taxId: typeof raw?.taxId === "string" ? raw.taxId : undefined,
    businessScope: typeof raw?.businessScope === "string" ? raw.businessScope : undefined,
    researchField: typeof raw?.researchField === "string" ? raw.researchField : undefined,
    personalPage: typeof raw?.personalPage === "string" ? raw.personalPage : undefined,
    academicTitle: typeof raw?.academicTitle === "string" ? raw.academicTitle : undefined,
    major: typeof raw?.major === "string" ? raw.major : undefined,
    platformIntents: Array.isArray(raw?.platformIntents) ? raw.platformIntents : undefined,
    onboardingDone: typeof raw?.onboardingDone === "boolean" ? raw.onboardingDone : undefined,
  };
}

function normalizeContent(raw: any): Content {
  return {
    id: String(raw?.id ?? ""),
    title: String(raw?.title ?? ""),
    description: String(raw?.description ?? ""),
    type: normalizeContentTypeValue(raw?.type),
    status: normalizeContentStatusValue(raw?.status),
    authorId: String(raw?.authorId ?? ""),
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
    tags: Array.isArray(raw?.tags) ? raw.tags.filter((item: unknown) => typeof item === "string") : [],
    likes: Number(raw?.likes ?? 0),
    views: Number(raw?.views ?? 0),
    coverImage: typeof raw?.coverImage === "string" ? raw.coverImage : undefined,
    visibility:
      raw?.visibility === undefined
        ? undefined
        : normalizeContentVisibilityValue(raw?.visibility),
    rejectReason: typeof raw?.rejectReason === "string" ? raw.rejectReason : undefined,
  };
}

function normalizeKnowledgeDocumentStatus(rawStatus: unknown): KnowledgeDocument["status"] {
  return normalizeDocumentStatusValue(rawStatus);
}

function toQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type HubQuery = {
  type?: string;
  q?: string;
  tags?: string[];
};

export async function fetchHubContents(query?: HubQuery): Promise<Content[]> {
  const params = toQueryString({
    type: query?.type,
    q: query?.q,
    tags: query?.tags?.join(","),
  });

  const response = await apiFetch(getApiPath(`/api/hub${params}`));
  if (!response.ok) {
    throw new Error(`Hub API failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content[] | { items?: Content[] }>);
  const list = Array.isArray(body) ? body : asArray<Content>((body as any)?.items);
  return list.map((item) => normalizeContent(item));
}

export type TalentQuery = {
  q?: string;
  tags?: string[];
  role?: Role | "ALL";
};

export async function fetchTalentUsers(query?: TalentQuery): Promise<User[]> {
  const params = toQueryString({
    q: query?.q,
    tags: query?.tags?.join(","),
    role: query?.role && query.role !== "ALL" ? query.role : undefined,
  });

  const response = await apiFetch(getApiPath(`/api/talent${params}`));
  if (!response.ok) {
    throw new Error(`Talent API failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User[] | { items?: User[] }>);
  const list = Array.isArray(body) ? body : asArray<User>((body as any)?.items);
  return list.map((item) => normalizeUser(item));
}

export type AuthLoginPayload = {
  email: string;
  password: string;
};

export type PublishDraftPayload = {
  title: string;
  description: string;
  type: Content["type"];
  tags: string[];
  visibility?: Content["visibility"];
};

export async function createPublishDraftByApi(payload: PublishDraftPayload): Promise<Content> {
  const response = await apiFetch(getApiPath("/api/publish"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Create publish draft"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content | { item?: Content; content?: Content }>);
  const content = (body as any)?.item ?? (body as any)?.content ?? body;
  return normalizeContent(content);
}

export async function submitPublishByApi(contentId: string): Promise<Content | null> {
  const response = await apiFetch(getApiPath(`/api/publish/${contentId}/submit`), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Submit publish"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content | { item?: Content; content?: Content; id?: string } | null>);
  if (!body) return null;
  const content = (body as any)?.item ?? (body as any)?.content ?? body;
  if (!content || typeof content !== "object") return null;
  return normalizeContent(content);
}

export async function updatePublishContentByApi(
  contentId: string,
  updates: Partial<Pick<Content, "title" | "description" | "tags" | "type">>,
): Promise<Content> {
  // Map frontend field names to backend DTO field names
  const { description, type, ...rest } = updates;
  const payload: Record<string, unknown> = { ...rest };
  if (description !== undefined) payload.summary = description;
  if (type !== undefined) payload.type = type.toLowerCase();
  const response = await apiFetch(getApiPath(`/api/hub/${contentId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Update publish content"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content | { item?: Content }>);
  const content = (body as any)?.item ?? body;
  return normalizeContent(content);
}

export async function fetchMyPublishContentsByApi(): Promise<Content[]> {
  const response = await apiFetch(getApiPath("/api/publish/mine"));
  if (!response.ok) {
    throw new Error(`Fetch my publish contents failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content[] | { items?: Content[] }>);
  const list = Array.isArray(body) ? body : asArray<Content>((body as any)?.items);
  return list.map((item) => normalizeContent(item));
}

export async function fetchAdminReviewQueueByApi(): Promise<Content[]> {
  const response = await apiFetch(getApiPath("/api/admin/review"));
  if (!response.ok) {
    throw new Error(`Fetch admin review queue failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content[] | { items?: Content[]; queue?: Content[] }>);
  const list = Array.isArray(body)
    ? body
    : asArray<Content>((body as any)?.items ?? (body as any)?.queue);
  return list.map((item) => normalizeContent(item));
}

export async function approveAdminReviewByApi(contentId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/admin/review/${contentId}/approve`), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Approve review failed: ${response.status}`);
  }
}

export async function rejectAdminReviewByApi(contentId: string, reason: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/admin/review/${contentId}/reject`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Reject review failed: ${response.status}`);
  }
}

export type AdminReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
};

export async function fetchAdminReportsApi(): Promise<AdminReport[]> {
  const response = await apiFetch(getApiPath("/api/admin/reports"));
  if (!response.ok) {
    throw new Error(`Fetch admin reports failed: ${response.status}`);
  }
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<AdminReport[] | { items?: AdminReport[] }>);
  return Array.isArray(body) ? body : asArray<AdminReport>((body as any)?.items);
}

export async function handleAdminReportApi(
  reportId: string,
  status: "resolved" | "dismissed",
  notes?: string,
): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/admin/reports/${reportId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Handle report"));
  }
}

export async function loginByApi(payload: AuthLoginPayload): Promise<User> {
  const response = await apiFetch(getApiPath("/api/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Auth login"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User | { user?: User }>);
  const user = (body as any)?.user ?? body;
  return normalizeUser(user);
}

export type AuthRegisterPayload = {
  email: string;
  password: string;
  displayName: string;
  inviteCode: string;
  phone?: string;
};

export async function registerByApi(payload: AuthRegisterPayload): Promise<User> {
  const response = await apiFetch(getApiPath("/api/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Register"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User | { user?: User }>);
  const user = (body as any)?.user ?? body;
  return normalizeUser(user);
}

export async function logoutByApi(): Promise<void> {
  try {
    await apiFetch(getApiPath("/api/auth/logout"), { method: "POST" });
  } catch {
    // Ignore network errors on logout — local state will be cleared regardless
  }
}

export async function forgotPasswordByApi(email: string): Promise<void> {
  const response = await apiFetch(getApiPath("/api/auth/forgot-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Forgot password"));
  }
}

export async function resetPasswordByApi(token: string, password: string): Promise<void> {
  const response = await apiFetch(getApiPath("/api/auth/reset-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Reset password"));
  }
}

export async function fetchMeByApi(): Promise<User> {
  const response = await apiFetch(getApiPath("/api/me"));
  if (!response.ok) {
    throw new Error(`Fetch me failed: ${response.status}`);
  }
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User | { user?: User }>);
  const user = (body as any)?.user ?? body;
  return normalizeUser(user);
}

export type UpdateProfilePayload = {
  displayName?: string;
  avatarUrl?: string;
  headline?: string;
  bio?: string;
  org?: string;
  title?: string;
  location?: string;
  contactEmail?: string;
  emailVisibility?: string;
  tags?: string[];
  // Social links
  socialLinks?: { github?: string; linkedin?: string; twitter?: string; website?: string };
  // About work
  whatImDoing?: string;
  whatICanProvide?: string;
  whatImLookingFor?: string;
  aiStrategy?: string;
  // Onboarding fields
  phone?: string;
  companyName?: string;
  taxId?: string;
  businessScope?: string;
  researchField?: string;
  personalPage?: string;
  academicTitle?: string;
  major?: string;
  platformIntents?: string[];
  onboardingDone?: boolean;
  role?: string;
};

export async function updateProfileByApi(payload: UpdateProfilePayload): Promise<User> {
  const dto = {
    ...payload,
    emailVisibility:
      payload.emailVisibility === undefined
        ? undefined
        : toBackendEmailVisibilityValue(payload.emailVisibility),
  };
  const response = await apiFetch(getApiPath("/api/profiles/me"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Update profile"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User | { user?: User }>);
  const user = (body as any)?.user ?? body;
  return normalizeUser(user);
}

export async function uploadAvatarByApi(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(getApiPath("/api/profiles/me/avatar"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Upload avatar"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User | { user?: User }>);
  const user = (body as any)?.user ?? body;
  return normalizeUser(user);
}

export async function fetchUserByIdApi(userId: string): Promise<User> {
  const response = await apiFetch(getApiPath(`/api/users/${userId}`));
  if (!response.ok) {
    throw new Error(`Fetch user failed: ${response.status}`);
  }
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User | { user?: User }>);
  const user = (body as any)?.user ?? body;
  return normalizeUser(user);
}

export async function fetchHubContentByIdApi(contentId: string): Promise<Content> {
  const response = await apiFetch(getApiPath(`/api/hub/${contentId}`));
  if (!response.ok) {
    throw new Error(`Fetch content failed: ${response.status}`);
  }
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content | { item?: Content; content?: Content }>);
  const content = (body as any)?.item ?? (body as any)?.content ?? body;
  return normalizeContent(content);
}

export async function likeHubContentByApi(contentId: string): Promise<{ likes: number }> {
  const response = await apiFetch(getApiPath(`/api/hub/${contentId}/like`), {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Like content"));
  }
  return response.json();
}

export async function fetchKnowledgeBaseFilesApi(): Promise<KnowledgeDocument[]> {
  const response = await apiFetch(getApiPath("/api/knowledge-base"));
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Fetch knowledge base files"));
  }
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<any>);
  const list = Array.isArray(body) ? body : asArray<any>((body as any)?.items ?? (body as any)?.files);
  return list.map((item: any) => ({
    id: item.id ?? "",
    userId: item.userId ?? "",
    name: item.name ?? item.fileName ?? "",
    size: Number(item.size ?? item.sizeBytes ?? 0),
    type: item.type ?? item.mimeType ?? "",
    status: normalizeKnowledgeDocumentStatus(item.status),
    errorMessage: typeof item.errorMessage === "string" ? item.errorMessage : undefined,
    uploadedAt: item.uploadedAt ?? item.createdAt ?? "",
  }));
}

export async function deleteKnowledgeBaseFileByApi(fileId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/knowledge-base/${fileId}`), {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Delete KB file failed: ${response.status}`);
  }
}

// ---- Applications ----

export type SubmitApplicationPayload = {
  targetType: string;
  targetId: string;
  message?: string;
};

function normalizeApplication(raw: any): import("../types").Application {
  return {
    id: String(raw?.id ?? ""),
    applicantId: String(raw?.applicantId ?? raw?.applicantUserId ?? ""),
    targetType: normalizeApplicationTargetTypeValue(raw?.targetType),
    targetId: String(raw?.targetId ?? ""),
    message: typeof raw?.message === "string" ? raw.message : undefined,
    status: normalizeApplicationStatusValue(raw?.status),
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
  };
}

export async function submitApplicationByApi(payload: SubmitApplicationPayload): Promise<import("../types").Application> {
  const response = await apiFetch(getApiPath("/api/applications"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      targetType: toBackendApplicationTargetTypeValue(payload.targetType),
    }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Submit application"));
  }
  const json = await response.json();
  const body = unwrap(json);
  return normalizeApplication(body);
}

export async function fetchMyApplicationsByApi(): Promise<import("../types").Application[]> {
  const response = await apiFetch(getApiPath("/api/applications/mine"));
  if (!response.ok) {
    throw new Error(`Fetch my applications failed: ${response.status}`);
  }
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<any>);
  const list = Array.isArray(body) ? body : asArray<any>((body as any)?.items);
  return list.map(normalizeApplication);
}

export async function updateApplicationStatusByApi(appId: string, status: "accepted" | "rejected"): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/applications/${appId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error(`Update application status failed: ${response.status}`);
  }
}

// ---- Dashboard / Profile data helpers ----

export async function fetchProfileByIdApi(userId: string): Promise<User> {
  const response = await apiFetch(getApiPath(`/api/profiles/${userId}`));
  if (!response.ok) {
    throw new Error(`Fetch profile failed: ${response.status}`);
  }
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<User | { user?: User }>);
  const user = (body as any)?.user ?? body;
  return normalizeUser(user);
}

export async function verifyInviteCodeByApi(code: string): Promise<InviteCode | null> {
  const response = await apiFetch(getApiPath("/api/auth/invite/verify"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Invite verify"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<InviteCode | { invite?: InviteCode; valid?: boolean; code?: string }>);
  if ((body as any)?.valid === false) {
    return null;
  }
  const invite = (body as any)?.invite ?? body;

  const normalized: InviteCode = {
    id: String((invite as any)?.id ?? `inv-${Date.now()}`),
    code: String((invite as any)?.code ?? code),
    role:
      typeof (invite as any)?.role === "string"
        ? normalizeRoleValue((invite as any)?.role)
        : undefined,
    issuedByAdminId: typeof (invite as any)?.issuedByAdminId === "string" ? (invite as any).issuedByAdminId : undefined,
    boundUserId: typeof (invite as any)?.boundUserId === "string" ? (invite as any).boundUserId : undefined,
    status: normalizeInviteStatusValue((invite as any)?.status),
    expiresAt: typeof (invite as any)?.expiresAt === "string" ? (invite as any).expiresAt : undefined,
    createdAt: typeof (invite as any)?.createdAt === "string" ? (invite as any).createdAt : new Date().toISOString(),
  };

  return normalized;
}

export async function fetchPublicInviteSamplesByApi(): Promise<PublicInviteSample[]> {
  const response = await apiFetch(getApiPath("/api/auth/invite/samples"));

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Fetch public invite samples"));
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<PublicInviteSample[] | { items?: PublicInviteSample[] }>);
  const list = Array.isArray(body) ? body : asArray<PublicInviteSample>((body as any)?.items);

  return list
    .map((item) => ({
      code: typeof (item as any)?.code === "string" ? (item as any).code : "",
      role: normalizeRoleValue((item as any)?.role),
    }))
    .filter((item) => item.code.length > 0);
}

function normalizeThreadStatus(status: unknown): ChatThread["status"] {
  return normalizeThreadStatusValue(status);
}

function normalizeMessage(raw: any): Message {
  return {
    id: String(raw?.id ?? `m-${Date.now()}`),
    senderId: String(raw?.senderId ?? raw?.fromUserId ?? ""),
    receiverId: String(raw?.receiverId ?? raw?.toUserId ?? ""),
    content: String(raw?.content ?? raw?.bodyText ?? ""),
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
    read: Boolean(raw?.read ?? false),
  };
}

function normalizeThread(raw: any, currentUserId: string, users: User[]): ChatThread {
  const rawParticipants = Array.isArray(raw?.participants) ? raw.participants : [];
  const participantUsers = rawParticipants
    .map((item: any) => {
      if (typeof item === "string") {
        return users.find((user) => user.id === item) ?? null;
      }
      if (item && typeof item === "object") {
        return normalizeUser(item);
      }
      return null;
    })
    .filter(Boolean) as User[];

  const participantIds = Array.isArray(raw?.participantIds)
    ? raw.participantIds.filter((item: unknown) => typeof item === "string")
    : [];

  const participants = participantUsers.length > 0
    ? participantUsers
    : participantIds
        .map((id: string) => users.find((user) => user.id === id) ?? null)
        .filter(Boolean) as User[];

  if (participants.length < 2) {
    const knownSelf = users.find((user) => user.id === currentUserId);
    const otherId = String(raw?.targetUserId ?? raw?.otherUserId ?? raw?.toUserId ?? "");
    const knownOther = users.find((user) => user.id === otherId);
    if (knownSelf) participants.push(knownSelf);
    if (knownOther && knownOther.id !== knownSelf?.id) participants.push(knownOther);
  }

  return {
    id: String(raw?.id ?? raw?.conversationId ?? ""),
    participants,
    lastMessage: raw?.lastMessage ? normalizeMessage(raw.lastMessage) : undefined,
    unreadCount: Number(raw?.unreadCount ?? 0),
    status: normalizeThreadStatus(raw?.status),
    initiatorId: String(raw?.initiatorId ?? raw?.fromUserId ?? currentUserId),
  };
}

export async function fetchMessageConversationsByApi(currentUserId: string, users: User[] = []): Promise<ChatThread[]> {
  const response = await apiFetch(getApiPath("/api/messages/conversations"));
  if (!response.ok) {
    throw new Error(`Fetch conversations failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<ChatThread[] | { items?: ChatThread[] }>);
  const list = Array.isArray(body) ? body : asArray<ChatThread>((body as any)?.items);
  return list.map((item) => normalizeThread(item, currentUserId, users));
}

export async function fetchMessageRequestsByApi(currentUserId: string, users: User[] = []): Promise<ChatThread[]> {
  const response = await apiFetch(getApiPath("/api/messages/requests"));
  if (!response.ok) {
    throw new Error(`Fetch message requests failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<ChatThread[] | { items?: ChatThread[] }>);
  const list = Array.isArray(body) ? body : asArray<ChatThread>((body as any)?.items);
  return list.map((item) => normalizeThread(item, currentUserId, users));
}

export async function createMessageConversationByApi(targetUserId: string, currentUserId: string, users: User[] = []): Promise<ChatThread> {
  const response = await apiFetch(getApiPath("/api/messages/conversations"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetUserId }),
  });

  if (!response.ok) {
    throw new Error(`Create conversation failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<ChatThread | { item?: ChatThread; conversation?: ChatThread }>);
  const thread = (body as any)?.item ?? (body as any)?.conversation ?? body;
  return normalizeThread(thread, currentUserId, users);
}

export async function fetchConversationMessagesByApi(conversationId: string): Promise<Message[]> {
  const response = await apiFetch(getApiPath(`/api/messages/conversations/${conversationId}/messages`));
  if (!response.ok) {
    throw new Error(`Fetch conversation messages failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Message[] | { items?: Message[] }>);
  const list = Array.isArray(body) ? body : asArray<Message>((body as any)?.items);
  return list.map((item) => normalizeMessage(item));
}

export async function sendConversationMessageByApi(conversationId: string, content: string): Promise<Message | null> {
  const response = await apiFetch(getApiPath(`/api/messages/conversations/${conversationId}/messages`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bodyText: content }),
  });

  if (!response.ok) {
    throw new Error(`Send conversation message failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Message | { item?: Message; message?: Message } | null>);
  if (!body) return null;
  const item = (body as any)?.item ?? (body as any)?.message ?? body;
  return normalizeMessage(item);
}

export async function markConversationReadByApi(conversationId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/messages/conversations/${conversationId}/read`), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Mark conversation read failed: ${response.status}`);
  }
}

export async function acceptMessageRequestByApi(requestId: string): Promise<string | null> {
  const response = await apiFetch(getApiPath(`/api/messages/requests/${requestId}/accept`), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Accept request failed: ${response.status}`);
  }

  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<{ conversationId?: string } | { item?: { conversationId?: string } }>);
  const payload = (body as any)?.item ?? body;
  return typeof (payload as any)?.conversationId === "string" ? (payload as any).conversationId : null;
}

export async function rejectMessageRequestByApi(requestId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/messages/requests/${requestId}/reject`), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Reject request failed: ${response.status}`);
  }
}

function normalizeRecommendResponse(raw: any): AssistantRecommendResult {
  const body = raw?.data ?? raw ?? {};

  const reply =
    body.reply ??
    body.message ??
    body.content ??
    body.text;

  const recommendations = Array.isArray(body.recommendations) ? body.recommendations : [];

  const userRec =
    recommendations.find((item: any) => item?.type === "user") ||
    body.recommendedUser ||
    body.user ||
    null;

  const contentRec =
    recommendations.find((item: any) => item?.type === "content") ||
    body.recommendedContent ||
    body.contentItem ||
    null;

  const recommendedUserId =
    body.recommendedUserId ??
    body.userId ??
    body.recommended_user_id ??
    userRec?.id;

  const recommendedContentId =
    body.recommendedContentId ??
    body.contentId ??
    body.recommended_content_id ??
    contentRec?.id;

  return {
    reply: typeof reply === "string" ? reply : undefined,
    recommendedUserId:
      typeof recommendedUserId === "string" ? recommendedUserId : undefined,
    recommendedContentId:
      typeof recommendedContentId === "string" ? recommendedContentId : undefined,
  };
}

export async function requestAssistantRecommend(
  payload: AssistantRecommendPayload,
): Promise<AssistantRecommendResult> {
  const response = await apiFetch(getApiPath("/api/assistant/recommend"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ApiError(
      await parseApiErrorDetails(response, "Assistant recommend"),
    );
  }

  const json = await response.json();
  return normalizeRecommendResponse(json);
}

function normalizeKbUploadResponse(raw: any): KnowledgeBaseUploadResult {
  const body = raw?.data ?? raw ?? {};
  return {
    id: typeof (body.id ?? body.fileId) === "string" ? (body.id ?? body.fileId) : undefined,
    name: typeof (body.name ?? body.fileName) === "string" ? (body.name ?? body.fileName) : undefined,
    size: typeof body.size === "number" ? body.size : undefined,
    type: typeof (body.type ?? body.mimeType) === "string" ? (body.type ?? body.mimeType) : undefined,
    status: normalizeKnowledgeDocumentStatus(body.status),
    errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : undefined,
    uploadedAt:
      typeof (body.uploadedAt ?? body.createdAt) === "string"
        ? (body.uploadedAt ?? body.createdAt)
        : undefined,
  };
}

export async function uploadKnowledgeBaseFile(file: File): Promise<KnowledgeBaseUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch(getApiPath("/api/knowledge-base/upload"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Knowledge base upload"));
  }

  const json = await response.json();
  return normalizeKbUploadResponse(json);
}

// ---- Enterprise ----

type EnterpriseProfileResponse = Pick<User, "aiStrategy" | "whatImDoing" | "whatImLookingFor">;

export async function fetchEnterpriseProfileByApi(): Promise<EnterpriseProfileResponse> {
  const response = await apiFetch(getApiPath("/api/enterprise/me"));
  if (!response.ok) throw new Error(await parseApiError(response, "Fetch enterprise profile"));
  const json = await response.json();
  const body = unwrap(json) as any;
  return {
    aiStrategy: body?.aiStrategyText ?? "",
    whatImDoing: body?.casesText ?? "",
    whatImLookingFor: body?.achievementsText ?? "",
  };
}

export type UpdateEnterpriseProfilePayload = {
  aiStrategy?: string;
  currentFocus?: string;
  lookingFor?: string;
};

export async function updateEnterpriseProfileByApi(payload: UpdateEnterpriseProfilePayload): Promise<EnterpriseProfileResponse> {
  const dto = {
    aiStrategyText: payload.aiStrategy,
    casesText: payload.currentFocus,
    achievementsText: payload.lookingFor,
  };
  const response = await apiFetch(getApiPath("/api/enterprise/me"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Update enterprise profile"));
  const json = await response.json();
  const body = unwrap(json) as any;
  return {
    aiStrategy: body?.aiStrategyText ?? dto.aiStrategyText ?? "",
    whatImDoing: body?.casesText ?? dto.casesText ?? "",
    whatImLookingFor: body?.achievementsText ?? dto.achievementsText ?? "",
  };
}

export type CreateEnterpriseNeedPayload = {
  title: string;
  description: string;
  tags?: string[];
  visibility?: string;
  background?: string;
  goal?: string;
  deliverables?: string;
  requiredRoles?: string[];
};

function normalizeEnterpriseNeed(raw: any): Content {
  const description =
    raw?.description ??
    raw?.background ??
    [raw?.background, raw?.goal, raw?.deliverables]
      .filter((item: unknown) => typeof item === "string" && item.trim().length > 0)
      .join("\n\n");

  return normalizeContent({
    ...raw,
    description,
    type: raw?.type ?? "PROJECT",
    status: raw?.status ?? raw?.reviewStatus,
    authorId: raw?.authorId ?? raw?.enterpriseUserId ?? "",
    visibility: raw?.visibility,
    tags: Array.isArray(raw?.tags) ? raw.tags : Array.isArray(raw?.requiredRoles) ? raw.requiredRoles : [],
  });
}

export async function createEnterpriseNeedByApi(payload: CreateEnterpriseNeedPayload): Promise<Content> {
  const dto = {
    title: payload.title,
    background: payload.background ?? payload.description,
    goal: payload.goal,
    deliverables: payload.deliverables,
    requiredRoles: payload.requiredRoles ?? payload.tags,
    visibility:
      payload.visibility === undefined
        ? undefined
        : toBackendContentVisibilityValue(payload.visibility),
  };
  const response = await apiFetch(getApiPath("/api/enterprise/needs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Create enterprise need"));
  const json = await response.json();
  const body = unwrap(json);
  return normalizeEnterpriseNeed((body as any)?.item ?? body);
}

export async function submitEnterpriseNeedByApi(needId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/enterprise/needs/${needId}/submit`), { method: "POST" });
  if (!response.ok) throw new Error(await parseApiError(response, "Submit enterprise need"));
}

export async function fetchEnterpriseNeedsByApi(query?: { q?: string; tags?: string[] }): Promise<Content[]> {
  const params = toQueryString({ q: query?.q, tags: query?.tags?.join(",") });
  const response = await apiFetch(getApiPath(`/api/enterprise/needs${params}`));
  if (!response.ok) throw new Error(`Fetch enterprise needs failed: ${response.status}`);
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content[] | { items?: Content[] }>);
  const list = Array.isArray(body) ? body : asArray<Content>((body as any)?.items);
  return list.map(normalizeEnterpriseNeed);
}

export async function fetchEnterpriseNeedByIdApi(needId: string): Promise<Content> {
  const response = await apiFetch(getApiPath(`/api/enterprise/needs/${needId}`));
  if (!response.ok) throw new Error(`Fetch enterprise need failed: ${response.status}`);
  const json = await response.json();
  return normalizeEnterpriseNeed(unwrap(json));
}

export async function fetchEnterpriseNeedApplicationsByApi(needId: string): Promise<import("../types").Application[]> {
  const response = await apiFetch(getApiPath(`/api/enterprise/needs/${needId}/applications`));
  if (!response.ok) throw new Error(`Fetch need applications failed: ${response.status}`);
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<any>);
  const list = Array.isArray(body) ? body : asArray<any>((body as any)?.items);
  return list.map(normalizeApplication);
}

// ---- Expert ----

export type CreateResearchProjectPayload = {
  title: string;
  description: string;
  tags?: string[];
  visibility?: string;
  neededSupport?: string;
};

function normalizeResearchProject(raw: any): Content {
  return normalizeContent({
    ...raw,
    description: raw?.description ?? raw?.summary ?? "",
    type: raw?.type ?? "PROJECT",
    status: raw?.status ?? raw?.reviewStatus,
    authorId: raw?.authorId ?? raw?.expertUserId ?? "",
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
  });
}

export async function createResearchProjectByApi(payload: CreateResearchProjectPayload): Promise<Content> {
  const dto = {
    title: payload.title,
    summary: payload.description,
    neededSupport: payload.neededSupport,
    tags: payload.tags,
  };
  const response = await apiFetch(getApiPath("/api/expert/research-projects"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Create research project"));
  const json = await response.json();
  const body = unwrap(json);
  return normalizeResearchProject((body as any)?.item ?? body);
}

export async function submitResearchProjectByApi(projectId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/expert/research-projects/${projectId}/submit`), { method: "POST" });
  if (!response.ok) throw new Error(await parseApiError(response, "Submit research project"));
}

export async function fetchMyResearchProjectsByApi(): Promise<Content[]> {
  const response = await apiFetch(getApiPath("/api/expert/research-projects"));
  if (!response.ok) throw new Error(`Fetch research projects failed: ${response.status}`);
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<Content[] | { items?: Content[] }>);
  const list = Array.isArray(body) ? body : asArray<Content>((body as any)?.items);
  return list.map(normalizeResearchProject);
}

export async function fetchResearchProjectApplicationsByApi(projectId: string): Promise<import("../types").Application[]> {
  const response = await apiFetch(getApiPath(`/api/expert/research-projects/${projectId}/applications`));
  if (!response.ok) throw new Error(`Fetch project applications failed: ${response.status}`);
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<any>);
  const list = Array.isArray(body) ? body : asArray<any>((body as any)?.items);
  return list.map(normalizeApplication);
}

// ---- Safety ----

export async function blockUserByApi(blockedId: string): Promise<void> {
  const response = await apiFetch(getApiPath("/api/safety/block"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockedId }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Block user"));
}

export async function unblockUserByApi(userId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/safety/block/${userId}`), { method: "DELETE" });
  if (!response.ok) throw new Error(await parseApiError(response, "Unblock user"));
}

export type ReportPayload = {
  targetType: string;
  targetId: string;
  reason: string;
};

export async function reportByApi(payload: ReportPayload): Promise<void> {
  const response = await apiFetch(getApiPath("/api/safety/report"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Report"));
}

// ---- Admin (additional) ----

export type AdminCreateHubItemPayload = {
  title: string;
  description: string;
  type: string;
  tags?: string[];
};

export async function adminCreateHubItemByApi(payload: AdminCreateHubItemPayload): Promise<Content> {
  const response = await apiFetch(getApiPath("/api/admin/hub-items"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Admin create hub item"));
  const json = await response.json();
  return normalizeContent(unwrap(json));
}

export type AdminGenerateInvitesPayload = {
  count: number;
  expiresInDays?: number;
};

export async function adminGenerateInvitesByApi(payload: AdminGenerateInvitesPayload): Promise<import("../types").InviteCode[]> {
  const response = await apiFetch(getApiPath("/api/admin/invites"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Generate invites"));
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<any>);
  return Array.isArray(body) ? body : asArray<any>((body as any)?.items ?? (body as any)?.codes);
}

export async function adminUpdateUserStatusByApi(userId: string, status: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/admin/users/${userId}/status`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Update user status"));
}

// ---- Hub (additional) ----

export async function createHubContentByApi(payload: PublishDraftPayload): Promise<Content> {
  const response = await apiFetch(getApiPath("/api/hub"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Create hub content"));
  const json = await response.json();
  return normalizeContent(unwrap(json));
}

export async function submitHubContentByApi(contentId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/hub/${contentId}/submit`), { method: "POST" });
  if (!response.ok) throw new Error(await parseApiError(response, "Submit hub content"));
}

export async function deleteHubContentByApi(contentId: string): Promise<void> {
  const response = await apiFetch(getApiPath(`/api/hub/${contentId}`), { method: "DELETE" });
  if (!response.ok) throw new Error(await parseApiError(response, "Delete hub content"));
}

// ---- Messages (additional) ----

export async function createMessageRequestByApi(toUserId: string): Promise<string | null> {
  const response = await apiFetch(getApiPath("/api/messages/requests"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Create message request"));
  const json = await response.json();
  const body = unwrap(json as ApiEnvelope<{ id?: string } | { item?: { id?: string } }>);
  const payload = (body as any)?.item ?? body;
  return typeof (payload as any)?.id === "string" ? (payload as any).id : null;
}
