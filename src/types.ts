import {
  APPLICATION_STATUS_VALUES,
  APPLICATION_TARGET_TYPE_VALUES,
  CONTENT_STATUS_VALUES,
  CONTENT_TYPE_VALUES,
  CONTENT_VISIBILITY_VALUES,
  DOCUMENT_STATUS_VALUES,
  EMAIL_VISIBILITY_VALUES,
  INVITE_STATUS_VALUES,
  ROLE_VALUES,
  THREAD_STATUS_VALUES,
  USER_REPORT_STATUS_VALUES,
} from "./lib/contracts";

export type Role = (typeof ROLE_VALUES)[number];

export type EmailVisibility = (typeof EMAIL_VISIBILITY_VALUES)[number];

export interface PrivacySettings {
  emailVisibility: EmailVisibility;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  bio?: string;
  skills?: string[];
  company?: string;
  title?: string;
  location?: string;
  contactEmail?: string;
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  privacySettings?: PrivacySettings;
  whatImDoing?: string;
  whatICanProvide?: string;
  whatImLookingFor?: string;
  aiStrategy?: string;
  blockedUsers?: string[];
  // Onboarding fields
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

export type ContentStatus = (typeof CONTENT_STATUS_VALUES)[number];
export type ContentType = (typeof CONTENT_TYPE_VALUES)[number];
export type ContentVisibility = (typeof CONTENT_VISIBILITY_VALUES)[number];

export interface Content {
  id: string;
  title: string;
  description: string;
  type: ContentType;
  status: ContentStatus;
  authorId: string;
  createdAt: string;
  tags: string[];
  likes: number;
  views: number;
  coverImage?: string;
  visibility?: ContentVisibility;
  rejectReason?: string;
}

export type DocumentStatus = (typeof DOCUMENT_STATUS_VALUES)[number];

export interface KnowledgeDocument {
  id: string;
  userId: string;
  name: string;
  size: number;
  type: string;
  status: DocumentStatus;
  errorMessage?: string;
  uploadedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export type ThreadStatus = (typeof THREAD_STATUS_VALUES)[number];

export interface ChatThread {
  id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  status: ThreadStatus;
  initiatorId: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendedUser?: User;
  recommendedContent?: Content;
}

export type InviteStatus = (typeof INVITE_STATUS_VALUES)[number];

export interface InviteCode {
  id: string;
  code: string;
  role?: Role;
  issuedByAdminId?: string;
  boundUserId?: string;
  status: InviteStatus;
  expiresAt?: string;
  createdAt: string;
}

export interface PublicInviteSample {
  code: string;
  role: Role;
}

// Application system for project participation
export type ApplicationStatus = (typeof APPLICATION_STATUS_VALUES)[number];
export type ApplicationTargetType = (typeof APPLICATION_TARGET_TYPE_VALUES)[number];

export interface Application {
  id: string;
  applicantId: string;
  targetType: ApplicationTargetType;
  targetId: string; // content id
  message?: string;
  status: ApplicationStatus;
  createdAt: string;
}

// Learning resources for Learner dashboard
export interface LearningResource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: "COURSE" | "VIDEO" | "TUTORIAL" | "PATH";
  source: string; // e.g. "Bilibili", "Coursera", "GitHub"
  tags: string[];
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}

export type UserReportStatus = (typeof USER_REPORT_STATUS_VALUES)[number];

export interface UserReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  threadId?: string;
  reason: string;
  detail?: string;
  status: UserReportStatus;
  createdAt: string;
  handledByAdminId?: string;
  handledAt?: string;
  adminNote?: string;
}
