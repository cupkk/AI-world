import {
  normalizeApplicationStatusValue,
  normalizeApplicationTargetTypeValue,
  normalizeContentStatusValue,
  normalizeContentTypeValue,
  normalizeContentVisibilityValue,
  normalizeDocumentStatusValue,
  normalizeEmailVisibilityValue,
  normalizeInviteStatusValue,
  normalizeRoleValue,
} from "../contracts";

export interface SerializedContent {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  authorId: string;
  createdAt: string;
  tags: string[];
  likes: number;
  views: number;
  coverImage?: string;
  visibility?: string;
  rejectReason?: string;
  author?: SerializedUser;
}

export function serializeHubItem(item: any): SerializedContent {
  return {
    id: item.id,
    title: item.title ?? "",
    description: item.summary ?? "",
    type: normalizeContentTypeValue(item.type),
    status: normalizeContentStatusValue(item.reviewStatus),
    authorId: item.authorUserId ?? item.adminUserId ?? "",
    createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt ?? ""),
    tags: item.tags ?? item.hubItemTags?.map((ht: any) => ht.tag?.name ?? ht.tagName) ?? [],
    likes: item.likesCount ?? 0,
    views: item.viewsCount ?? 0,
    coverImage: item.coverUrl ?? undefined,
    visibility: undefined,
    rejectReason: item.rejectReason ?? undefined,
    ...(item.author ? { author: serializeUser(item.author, { maskEmail: true }) } : {}),
  };
}

export function serializeEnterpriseNeed(item: any): SerializedContent {
  return {
    id: item.id,
    title: item.title ?? "",
    description: item.background ?? "",
    type: "PROJECT",
    status: normalizeContentStatusValue(item.reviewStatus),
    authorId: item.enterpriseUserId ?? "",
    createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt ?? ""),
    tags: Array.isArray(item.requiredRoles) ? item.requiredRoles : [],
    likes: 0,
    views: 0,
    visibility: normalizeContentVisibilityValue(item.visibility),
    rejectReason: item.rejectReason ?? undefined,
  };
}

export function serializeResearchProject(item: any): SerializedContent {
  return {
    id: item.id,
    title: item.title ?? "",
    description: item.summary ?? "",
    type: "PROJECT",
    status: normalizeContentStatusValue(item.reviewStatus),
    authorId: item.expertUserId ?? "",
    createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt ?? ""),
    tags: Array.isArray(item.tags) ? item.tags : [],
    likes: 0,
    views: 0,
    rejectReason: item.rejectReason ?? undefined,
  };
}

export interface SerializedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  avatar: string;
  bio?: string;
  skills?: string[];
  company?: string;
  title?: string;
  location?: string;
  contactEmail?: string;
  socialLinks?: Record<string, string>;
  privacySettings?: { emailVisibility: string };
  whatImDoing?: string;
  whatICanProvide?: string;
  whatImLookingFor?: string;
  aiStrategy?: string;
  blockedUsers?: string[];
  phone?: string;
  phonePublic?: boolean;
  companyName?: string;
  taxId?: string;
  businessScope?: string;
  researchField?: string;
  personalPage?: string;
  academicTitle?: string;
  major?: string;
  platformIntents?: string[];
  onboardingDone?: boolean;
}

export function serializeUser(user: any, opts?: { maskEmail?: boolean }): SerializedUser {
  const profile = user.profile ?? {};
  const tags = profile.profileTags?.map((pt: any) => pt.tag?.name ?? pt.tagName).filter(Boolean) ?? [];

  let accountEmail = user.email ?? "";
  if (opts?.maskEmail && profile.emailVisibility === "hidden") {
    accountEmail = "";
  } else if (opts?.maskEmail && profile.emailVisibility === "masked") {
    accountEmail = maskEmail(accountEmail) ?? "";
  }

  let contactEmail = profile.contactEmail ?? undefined;
  if (opts?.maskEmail && profile.emailVisibility === "hidden") {
    contactEmail = undefined;
  } else if (opts?.maskEmail && profile.emailVisibility === "masked") {
    contactEmail = maskEmail(contactEmail);
  }

  return {
    id: user.id,
    name: profile.displayName ?? "",
    email: accountEmail,
    role: normalizeRoleValue(user.role),
    status: user.status ?? "pending_identity_review",
    avatar: profile.avatarUrl ?? "",
    bio: profile.bio ?? undefined,
    skills: tags.length > 0 ? tags : undefined,
    company: profile.org ?? undefined,
    title: profile.headline ?? profile.title ?? undefined,
    location: profile.location ?? undefined,
    contactEmail,
    socialLinks: profile.socialLinks ?? undefined,
    privacySettings: profile.emailVisibility
      ? { emailVisibility: normalizeEmailVisibilityValue(profile.emailVisibility) }
      : undefined,
    whatImDoing: profile.whatImDoing ?? undefined,
    whatICanProvide: profile.whatICanProvide ?? undefined,
    whatImLookingFor: profile.whatImLookingFor ?? undefined,
    aiStrategy: profile.aiStrategy ?? undefined,
    phone: profile.phone ?? undefined,
    phonePublic: profile.phonePublic ?? false,
    companyName: profile.companyName ?? undefined,
    taxId: profile.taxId ?? undefined,
    businessScope: profile.businessScope ?? undefined,
    researchField: profile.researchField ?? undefined,
    personalPage: profile.personalPage ?? undefined,
    academicTitle: profile.academicTitle ?? undefined,
    major: profile.major ?? undefined,
    platformIntents: Array.isArray(profile.platformIntents) ? profile.platformIntents : undefined,
    onboardingDone: profile.onboardingDone ?? false,
  };
}

function maskEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.charAt(0)}***@${domain}`;
}

export interface SerializedThread {
  id: string;
  participants: SerializedUser[];
  lastMessage?: SerializedMessage;
  unreadCount: number;
  status: string;
  initiatorId: string;
}

export interface SerializedMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export function serializeMessage(msg: any, receiverId?: string): SerializedMessage {
  return {
    id: msg.id,
    senderId: msg.senderId ?? msg.sender_id ?? "",
    receiverId: receiverId ?? "",
    content: msg.bodyText ?? msg.body_text ?? "",
    createdAt: msg.createdAt?.toISOString?.() ?? String(msg.createdAt ?? ""),
    read: false,
  };
}

export interface SerializedKbFile {
  id: string;
  userId: string;
  name: string;
  size: number;
  type: string;
  status: string;
  errorMessage?: string;
  uploadedAt: string;
}

export function serializeKbFile(file: any): SerializedKbFile {
  return {
    id: file.id,
    userId: file.ownerUserId,
    name: file.fileName,
    size: file.sizeBytes ? Number(file.sizeBytes) : 0,
    type: file.mimeType ?? "",
    status: normalizeDocumentStatusValue(file.status),
    errorMessage: file.errorMessage ?? undefined,
    uploadedAt: file.createdAt?.toISOString?.() ?? String(file.createdAt ?? ""),
  };
}

export function serializeInvite(invite: any) {
  return {
    id: invite.id,
    code: invite.code,
    status: normalizeInviteStatusValue(invite.status),
    issuedByAdminId: invite.issuedByAdminId ?? undefined,
    boundUserId: invite.boundUserId ?? undefined,
    expiresAt: invite.expiresAt?.toISOString?.() ?? undefined,
    createdAt: invite.createdAt?.toISOString?.() ?? String(invite.createdAt ?? ""),
  };
}

export function serializeApplication(app: any) {
  return {
    id: app.id,
    applicantId: app.applicantUserId,
    targetType: normalizeApplicationTargetTypeValue(app.targetType),
    targetId: app.targetId,
    message: app.message ?? undefined,
    status: normalizeApplicationStatusValue(app.status),
    createdAt: app.createdAt?.toISOString?.() ?? String(app.createdAt ?? ""),
  };
}
