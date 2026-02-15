-- 004_analytics.sql: View tracking and stats

CREATE TABLE post_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    viewer_ip INET,
    referrer TEXT NOT NULL DEFAULT '',
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE post_stats (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    view_date DATE NOT NULL,
    view_count INT NOT NULL DEFAULT 0,
    unique_views INT NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, view_date)
);

CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_viewed_at ON post_views(viewed_at);
CREATE INDEX idx_post_stats_post_id ON post_stats(post_id);
