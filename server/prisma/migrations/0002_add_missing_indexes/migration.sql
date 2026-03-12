-- Add missing performance indexes
CREATE INDEX IF NOT EXISTS "hub_items_type_idx" ON "hub_items"("type");
CREATE INDEX IF NOT EXISTS "hub_items_created_at_idx" ON "hub_items"("created_at");

CREATE INDEX IF NOT EXISTS "conversation_members_user_id_idx"
  ON "conversation_members"("user_id");

CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx"
  ON "conversations"("last_message_at");

CREATE INDEX IF NOT EXISTS "message_requests_to_user_id_idx"
  ON "message_requests"("to_user_id");

CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
CREATE INDEX IF NOT EXISTS "reports_reporter_id_idx" ON "reports"("reporter_id");
