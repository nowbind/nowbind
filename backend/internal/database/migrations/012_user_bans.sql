-- 012_user_bans.sql: Account suspension support for auth middleware

CREATE TABLE IF NOT EXISTS user_bans (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT '',
    banned_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward compatibility for installations that already created user_bans
-- with a legacy shape (without banned_until/created_at/updated_at defaults).
ALTER TABLE user_bans ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE user_bans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE user_bans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE user_bans ADD COLUMN IF NOT EXISTS reason TEXT;

UPDATE user_bans
SET
    reason = COALESCE(reason, ''),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE reason IS NULL OR created_at IS NULL OR updated_at IS NULL;

ALTER TABLE user_bans ALTER COLUMN reason SET DEFAULT '';
ALTER TABLE user_bans ALTER COLUMN reason SET NOT NULL;
ALTER TABLE user_bans ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE user_bans ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE user_bans ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE user_bans ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_bans_banned_until ON user_bans(banned_until);
