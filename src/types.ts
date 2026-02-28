export type Role = "EXPERT" | "LEARNER" | "ENTERPRISE_LEADER" | "ADMIN";

export type EmailVisibility = "FULL" | "MASKED" | "HIDDEN";

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
}

export type ContentStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED";
export type ContentType = "CONTEST" | "PAPER" | "POLICY" | "PROJECT" | "TOOL";
export type ContentVisibility = "ALL" | "EXPERTS_LEARNERS";

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

export type DocumentStatus = "PROCESSING" | "READY" | "FAILED";

export interface KnowledgeDocument {
  id: string;
  userId: string;
  name: string;
  size: number;
  type: string;
  status: DocumentStatus;
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

export type ThreadStatus = "PENDING" | "ACCEPTED" | "REJECTED";

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

export type InviteStatus = "UNUSED" | "USED" | "REVOKED";

export interface InviteCode {
  id: string;
  code: string;
  issuedByAdminId?: string;
  boundUserId?: string;
  status: InviteStatus;
  expiresAt?: string;
  createdAt: string;
}

// Application system for project participation
export type ApplicationStatus = "SUBMITTED" | "ACCEPTED" | "REJECTED";
export type ApplicationTargetType = "ENTERPRISE_NEED" | "RESEARCH_PROJECT" | "PROJECT";

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
