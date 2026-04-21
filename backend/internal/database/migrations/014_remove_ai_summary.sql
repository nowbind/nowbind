-- 014_remove_ai_summary.sql: Drop redundant ai_summary column; excerpt is the single summary source

ALTER TABLE posts DROP COLUMN IF EXISTS ai_summary;
