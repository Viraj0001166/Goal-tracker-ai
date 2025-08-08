
ALTER TABLE goals ADD COLUMN user_id TEXT;
ALTER TABLE daily_logs ADD COLUMN user_id TEXT;
ALTER TABLE ai_suggestions ADD COLUMN user_id TEXT;
ALTER TABLE faq_questions ADD COLUMN user_id TEXT;
