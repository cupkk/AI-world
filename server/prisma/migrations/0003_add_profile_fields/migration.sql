-- AlterTable: Add missing profile fields for all roles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(30);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "phone_public" BOOLEAN NOT NULL DEFAULT false;

-- Enterprise-specific
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "company_name" VARCHAR(255);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "tax_id" VARCHAR(100);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "business_scope" TEXT;

-- Expert-specific
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "research_field" VARCHAR(255);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "personal_page" VARCHAR(512);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "academic_title" VARCHAR(100);

-- Learner-specific
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "major" VARCHAR(255);

-- Onboarding & intents
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "platform_intents" JSONB;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "onboarding_done" BOOLEAN NOT NULL DEFAULT false;
