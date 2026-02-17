-- 011_feature_parity.sql: Feature image, featured flag, user profile enhancements

-- Posts: feature image and featured flag
ALTER TABLE posts ADD COLUMN IF NOT EXISTS feature_image TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

-- Users: social links and SEO metadata
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Index for featured posts queries
CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts(featured) WHERE featured = TRUE;
