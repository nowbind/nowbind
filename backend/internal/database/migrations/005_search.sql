-- 005_search.sql: Full-text search with tsvector and trigram

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- GIN index for full-text search
CREATE INDEX idx_posts_search_vector ON posts USING GIN(search_vector);

-- Trigram index on title for fuzzy matching
CREATE INDEX idx_posts_title_trgm ON posts USING GIN(title gin_trgm_ops);

-- Function to update search vector
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.subtitle, '') || ' ' || COALESCE(NEW.excerpt, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector
CREATE TRIGGER trg_posts_search_vector_update
    BEFORE INSERT OR UPDATE OF title, subtitle, excerpt, content ON posts
    FOR EACH ROW
    EXECUTE FUNCTION posts_search_vector_update();

-- Backfill existing posts
UPDATE posts SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(subtitle, '') || ' ' || COALESCE(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'C');
