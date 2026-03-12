export const ROLE_VALUES = ["EXPERT", "LEARNER", "ENTERPRISE_LEADER", "ADMIN"] as const;
export const EMAIL_VISIBILITY_VALUES = ["PUBLIC", "MASKED", "HIDDEN"] as const;
export const CONTENT_STATUS_VALUES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED"] as const;
export const CONTENT_TYPE_VALUES = ["CONTEST", "PAPER", "POLICY", "PROJECT", "TOOL"] as const;
export const CONTENT_VISIBILITY_VALUES = ["ALL", "EXPERTS_LEARNERS"] as const;
export const DOCUMENT_STATUS_VALUES = ["PROCESSING", "READY", "FAILED"] as const;
export const THREAD_STATUS_VALUES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export const INVITE_STATUS_VALUES = ["UNUSED", "USED", "REVOKED"] as const;
export const APPLICATION_STATUS_VALUES = ["SUBMITTED", "ACCEPTED", "REJECTED"] as const;
export const APPLICATION_TARGET_TYPE_VALUES = ["ENTERPRISE_NEED", "RESEARCH_PROJECT", "PROJECT"] as const;
export const USER_REPORT_STATUS_VALUES = ["PENDING", "RESOLVED", "DISMISSED"] as const;

type EnumValue<T extends readonly string[]> = T[number];
type AliasMap<T extends readonly string[]> = Record<string, EnumValue<T>>;

function normalizeEnumInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseEnumValue<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fallback: EnumValue<T>,
): EnumValue<T> {
  const normalized = normalizeEnumInput(value);
  if (!normalized) return fallback;
  return allowedValues.includes(normalized as EnumValue<T>)
    ? (normalized as EnumValue<T>)
    : fallback;
}

export function parseCanonicalEnumValue<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fallback: EnumValue<T>,
  aliases: AliasMap<T>,
): EnumValue<T> {
  const normalized = normalizeEnumInput(value);
  if (!normalized) return fallback;
  if (allowedValues.includes(normalized as EnumValue<T>)) {
    return normalized as EnumValue<T>;
  }
  return aliases[normalized.toLowerCase()] ?? fallback;
}

const ROLE_ALIASES: AliasMap<typeof ROLE_VALUES> = {
  expert: "EXPERT",
  learner: "LEARNER",
  enterprise_leader: "ENTERPRISE_LEADER",
  admin: "ADMIN",
};

const EMAIL_VISIBILITY_ALIASES: AliasMap<typeof EMAIL_VISIBILITY_VALUES> = {
  public: "PUBLIC",
  full: "PUBLIC",
  masked: "MASKED",
  hidden: "HIDDEN",
};

const CONTENT_STATUS_ALIASES: AliasMap<typeof CONTENT_STATUS_VALUES> = {
  draft: "DRAFT",
  pending_review: "PENDING_REVIEW",
  published: "PUBLISHED",
  rejected: "REJECTED",
};

const CONTENT_TYPE_ALIASES: AliasMap<typeof CONTENT_TYPE_VALUES> = {
  contest: "CONTEST",
  paper: "PAPER",
  policy: "POLICY",
  project: "PROJECT",
  tool: "TOOL",
};

const CONTENT_VISIBILITY_ALIASES: AliasMap<typeof CONTENT_VISIBILITY_VALUES> = {
  all: "ALL",
  public_all: "ALL",
  experts_learners: "EXPERTS_LEARNERS",
  experts_and_learners: "EXPERTS_LEARNERS",
};

const DOCUMENT_STATUS_ALIASES: AliasMap<typeof DOCUMENT_STATUS_VALUES> = {
  processing: "PROCESSING",
  uploaded: "PROCESSING",
  parsing: "PROCESSING",
  embedded: "PROCESSING",
  ready: "READY",
  failed: "FAILED",
};

const THREAD_STATUS_ALIASES: AliasMap<typeof THREAD_STATUS_VALUES> = {
  pending: "PENDING",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
};

const INVITE_STATUS_ALIASES: AliasMap<typeof INVITE_STATUS_VALUES> = {
  unused: "UNUSED",
  used: "USED",
  revoked: "REVOKED",
};

const APPLICATION_STATUS_ALIASES: AliasMap<typeof APPLICATION_STATUS_VALUES> = {
  submitted: "SUBMITTED",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
  rejected_app: "REJECTED",
};

const APPLICATION_TARGET_TYPE_ALIASES: AliasMap<typeof APPLICATION_TARGET_TYPE_VALUES> = {
  enterprise_need: "ENTERPRISE_NEED",
  research_project: "RESEARCH_PROJECT",
  hub_project: "PROJECT",
  project: "PROJECT",
};

export function normalizeRoleValue(value: unknown): EnumValue<typeof ROLE_VALUES> {
  return parseCanonicalEnumValue(value, ROLE_VALUES, "LEARNER", ROLE_ALIASES);
}

export function normalizeEmailVisibilityValue(
  value: unknown,
): EnumValue<typeof EMAIL_VISIBILITY_VALUES> {
  return parseCanonicalEnumValue(
    value,
    EMAIL_VISIBILITY_VALUES,
    "HIDDEN",
    EMAIL_VISIBILITY_ALIASES,
  );
}

export function normalizeContentStatusValue(
  value: unknown,
): EnumValue<typeof CONTENT_STATUS_VALUES> {
  return parseCanonicalEnumValue(
    value,
    CONTENT_STATUS_VALUES,
    "DRAFT",
    CONTENT_STATUS_ALIASES,
  );
}

export function normalizeContentTypeValue(value: unknown): EnumValue<typeof CONTENT_TYPE_VALUES> {
  return parseCanonicalEnumValue(value, CONTENT_TYPE_VALUES, "PROJECT", CONTENT_TYPE_ALIASES);
}

export function normalizeContentVisibilityValue(
  value: unknown,
): EnumValue<typeof CONTENT_VISIBILITY_VALUES> {
  return parseCanonicalEnumValue(
    value,
    CONTENT_VISIBILITY_VALUES,
    "ALL",
    CONTENT_VISIBILITY_ALIASES,
  );
}

export function normalizeDocumentStatusValue(
  value: unknown,
): EnumValue<typeof DOCUMENT_STATUS_VALUES> {
  return parseCanonicalEnumValue(
    value,
    DOCUMENT_STATUS_VALUES,
    "PROCESSING",
    DOCUMENT_STATUS_ALIASES,
  );
}

export function normalizeThreadStatusValue(
  value: unknown,
): EnumValue<typeof THREAD_STATUS_VALUES> {
  return parseCanonicalEnumValue(
    value,
    THREAD_STATUS_VALUES,
    "PENDING",
    THREAD_STATUS_ALIASES,
  );
}

export function normalizeInviteStatusValue(
  value: unknown,
): EnumValue<typeof INVITE_STATUS_VALUES> {
  return parseCanonicalEnumValue(
    value,
    INVITE_STATUS_VALUES,
    "UNUSED",
    INVITE_STATUS_ALIASES,
  );
}

export function normalizeApplicationStatusValue(
  value: unknown,
): EnumValue<typeof APPLICATION_STATUS_VALUES> {
  return parseCanonicalEnumValue(
    value,
    APPLICATION_STATUS_VALUES,
    "SUBMITTED",
    APPLICATION_STATUS_ALIASES,
  );
}

export function normalizeApplicationTargetTypeValue(
  value: unknown,
): EnumValue<typeof APPLICATION_TARGET_TYPE_VALUES> {
  return parseCanonicalEnumValue(
    value,
    APPLICATION_TARGET_TYPE_VALUES,
    "PROJECT",
    APPLICATION_TARGET_TYPE_ALIASES,
  );
}

const CONTENT_VISIBILITY_TO_BACKEND: Record<
  EnumValue<typeof CONTENT_VISIBILITY_VALUES>,
  "public_all" | "experts_and_learners"
> = {
  ALL: "public_all",
  EXPERTS_LEARNERS: "experts_and_learners",
};

const APPLICATION_TARGET_TYPE_TO_BACKEND: Record<
  EnumValue<typeof APPLICATION_TARGET_TYPE_VALUES>,
  "enterprise_need" | "research_project" | "hub_project"
> = {
  ENTERPRISE_NEED: "enterprise_need",
  RESEARCH_PROJECT: "research_project",
  PROJECT: "hub_project",
};

const EMAIL_VISIBILITY_TO_BACKEND: Record<
  EnumValue<typeof EMAIL_VISIBILITY_VALUES>,
  "public" | "masked" | "hidden"
> = {
  PUBLIC: "public",
  MASKED: "masked",
  HIDDEN: "hidden",
};

export function toBackendContentVisibilityValue(
  value: unknown,
): "public_all" | "experts_and_learners" {
  return CONTENT_VISIBILITY_TO_BACKEND[normalizeContentVisibilityValue(value)];
}

export function toBackendApplicationTargetTypeValue(
  value: unknown,
): "enterprise_need" | "research_project" | "hub_project" {
  return APPLICATION_TARGET_TYPE_TO_BACKEND[normalizeApplicationTargetTypeValue(value)];
}

export function toBackendEmailVisibilityValue(
  value: unknown,
): "public" | "masked" | "hidden" {
  return EMAIL_VISIBILITY_TO_BACKEND[normalizeEmailVisibilityValue(value)];
}
