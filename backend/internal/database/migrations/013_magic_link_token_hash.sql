-- 013_magic_link_token_hash.sql: Store only hashed magic-link tokens

ALTER TABLE magic_links
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);

-- Keep token column only for backwards compatibility with old rows; new rows use token_hash.
ALTER TABLE magic_links
    ALTER COLUMN token DROP NOT NULL;

ALTER TABLE magic_links
    DROP CONSTRAINT IF EXISTS magic_links_token_key;

DROP INDEX IF EXISTS idx_magic_links_token;

CREATE UNIQUE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash)
    WHERE token_hash IS NOT NULL;
