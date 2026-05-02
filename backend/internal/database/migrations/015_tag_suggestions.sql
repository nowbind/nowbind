-- 015_tag_suggestions.sql
-- Stores ML-suggested tags per post.
-- Persists regardless of whether the user accepts or ignores suggestions.

CREATE TABLE IF NOT EXISTS post_tag_suggestions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    keyword         TEXT NOT NULL,
    score           NUMERIC(6, 4) NOT NULL,
    is_existing_tag BOOLEAN NOT NULL DEFAULT FALSE,
    matched_tag     TEXT,           -- tag name/slug if is_existing_tag = true
    accepted        BOOLEAN,        -- NULL = pending, TRUE = accepted, FALSE = dismissed
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, keyword)       -- one suggestion per keyword per post
);

CREATE INDEX IF NOT EXISTS idx_post_tag_suggestions_post
    ON post_tag_suggestions(post_id);

CREATE INDEX IF NOT EXISTS idx_post_tag_suggestions_pending
    ON post_tag_suggestions(post_id, accepted)
    WHERE accepted IS NULL;
