-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EXPERT', 'ENTERPRISE_LEADER', 'LEARNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending_identity_review', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('unused', 'used', 'revoked');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'pending_review', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "HubItemType" AS ENUM ('contest', 'paper', 'policy', 'project', 'tool');

-- CreateEnum
CREATE TYPE "NeedVisibility" AS ENUM ('public_all', 'experts_and_learners');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('submitted', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "ApplicationTargetType" AS ENUM ('enterprise_need', 'research_project', 'hub_project');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('dm');

-- CreateEnum
CREATE TYPE "MessageRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "KbFileStatus" AS ENUM ('uploaded', 'parsing', 'embedded', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "EmailVisibility" AS ENUM ('public', 'masked', 'hidden');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'pending_identity_review',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(32) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'unused',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "issued_by_admin_id" UUID,
    "bound_user_id" UUID,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(512),
    "headline" VARCHAR(255),
    "bio" TEXT,
    "org" VARCHAR(255),
    "title" VARCHAR(255),
    "location" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "email_visibility" "EmailVisibility" NOT NULL DEFAULT 'hidden',
    "social_links" JSONB,
    "what_im_doing" TEXT,
    "what_i_can_provide" TEXT,
    "what_im_looking_for" TEXT,
    "ai_strategy" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_tags" (
    "profile_user_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "profile_tags_pkey" PRIMARY KEY ("profile_user_id","tag_id")
);

-- CreateTable
CREATE TABLE "hub_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "HubItemType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "content_rich" TEXT,
    "cover_url" VARCHAR(512),
    "source_url" VARCHAR(512),
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'draft',
    "reject_reason" TEXT,
    "published_at" TIMESTAMP(3),
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "author_user_id" UUID,
    "admin_user_id" UUID,

    CONSTRAINT "hub_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_item_tags" (
    "hub_item_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "hub_item_tags_pkey" PRIMARY KEY ("hub_item_id","tag_id")
);

-- CreateTable
CREATE TABLE "enterprise_profiles" (
    "user_id" UUID NOT NULL,
    "ai_strategy_text" TEXT,
    "cases_text" TEXT,
    "achievements_text" TEXT,
    "generated_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "enterprise_needs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "background" TEXT,
    "goal" TEXT,
    "deliverables" TEXT,
    "required_roles" JSONB,
    "visibility" "NeedVisibility" NOT NULL DEFAULT 'public_all',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'draft',
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "enterprise_user_id" UUID NOT NULL,

    CONSTRAINT "enterprise_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "needed_support" TEXT,
    "tags" JSONB,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'draft',
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "expert_user_id" UUID NOT NULL,

    CONSTRAINT "research_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "ApplicationTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "message" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'submitted',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "applicant_user_id" UUID NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ConversationType" NOT NULL DEFAULT 'dm',
    "last_message_at" TIMESTAMP(3),
    "last_message_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_message_id" UUID,
    "last_read_at" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "body_text" TEXT NOT NULL,
    "client_msg_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "MessageRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "conversation_id" UUID,

    CONSTRAINT "message_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reporter_id" UUID NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "oss_key" VARCHAR(512),
    "local_path" VARCHAR(512),
    "file_url" VARCHAR(512),
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100),
    "size_bytes" BIGINT,
    "status" "KbFileStatus" NOT NULL DEFAULT 'uploaded',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "owner_user_id" UUID NOT NULL,

    CONSTRAINT "kb_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chunk_index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1536),
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kb_file_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" UUID,
    "metadata" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invites_bound_user_id_key" ON "invites"("bound_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "applications_applicant_user_id_target_type_target_id_key" ON "applications"("applicant_user_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_sender_id_client_msg_id_key" ON "messages"("sender_id", "client_msg_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_requests_from_user_id_to_user_id_key" ON "message_requests"("from_user_id", "to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key" ON "user_blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "kb_chunks_owner_user_id_idx" ON "kb_chunks"("owner_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_issued_by_admin_id_fkey" FOREIGN KEY ("issued_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_bound_user_id_fkey" FOREIGN KEY ("bound_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_profile_user_id_fkey" FOREIGN KEY ("profile_user_id") REFERENCES "profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_items" ADD CONSTRAINT "hub_items_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_items" ADD CONSTRAINT "hub_items_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_item_tags" ADD CONSTRAINT "hub_item_tags_hub_item_id_fkey" FOREIGN KEY ("hub_item_id") REFERENCES "hub_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_item_tags" ADD CONSTRAINT "hub_item_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_profiles" ADD CONSTRAINT "enterprise_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_needs" ADD CONSTRAINT "enterprise_needs_enterprise_user_id_fkey" FOREIGN KEY ("enterprise_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_expert_user_id_fkey" FOREIGN KEY ("expert_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_requests" ADD CONSTRAINT "message_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_requests" ADD CONSTRAINT "message_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_files" ADD CONSTRAINT "kb_files_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_kb_file_id_fkey" FOREIGN KEY ("kb_file_id") REFERENCES "kb_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

