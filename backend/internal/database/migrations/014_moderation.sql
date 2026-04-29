-- 014_moderation.sql
-- Stores moderation flags for posts and comments that were flagged or blocked.
-- Allows admins to review "flag_for_review" content.

CREATE TABLE IF NOT EXISTS moderation_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('post', 'comment')),
    entity_id   UUID NOT NULL,
    label       TEXT NOT NULL,
    score       NUMERIC(5, 4) NOT NULL,
    threshold   NUMERIC(5, 4) NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('block', 'flag_for_review')),
    reviewed    BOOLEAN NOT NULL DEFAULT FALSE,
    reviewer_id UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_entity ON moderation_flags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_reviewed ON moderation_flags(reviewed) WHERE reviewed = FALSE;

-- Track moderation status on posts table
ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS moderation_status TEXT
        NOT NULL DEFAULT 'clean'
        CHECK (moderation_status IN ('clean', 'flagged', 'blocked'));
