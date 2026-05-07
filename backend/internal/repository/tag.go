package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/pkg"
)

type TagRepository struct {
	pool *pgxpool.Pool
}

func NewTagRepository(pool *pgxpool.Pool) *TagRepository {
	return &TagRepository{pool: pool}
}

func (r *TagRepository) List(ctx context.Context) ([]model.Tag, error) {
	tags, _, err := r.ListPaginated(ctx, 1, 50)
	return tags, err
}

func (r *TagRepository) ListPaginated(ctx context.Context, page, perPage int) ([]model.Tag, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	var total int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM tags").Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting tags: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, slug, post_count
		 FROM tags
		 ORDER BY post_count DESC, name ASC
		 LIMIT $1 OFFSET $2`,
		perPage, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("listing tags: %w", err)
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.PostCount); err != nil {
			return nil, 0, fmt.Errorf("scanning tag: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, total, nil
}

func (r *TagRepository) GetBySlug(ctx context.Context, slug string) (*model.Tag, error) {
	tag := &model.Tag{}
	err := r.pool.QueryRow(ctx,
		"SELECT id, name, slug, post_count FROM tags WHERE slug = $1", slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.PostCount)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting tag by slug: %w", err)
	}
	return tag, nil
}

func (r *TagRepository) FindOrCreate(ctx context.Context, name string) (*model.Tag, error) {
	slug := pkg.Slugify(name)
	tag := &model.Tag{}

	err := r.pool.QueryRow(ctx,
		`INSERT INTO tags (name, slug) VALUES ($1, $2)
		 ON CONFLICT (slug) DO UPDATE SET name = tags.name
		 RETURNING id, name, slug, post_count`,
		name, slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.PostCount)
	if err != nil {
		return nil, fmt.Errorf("finding or creating tag: %w", err)
	}
	return tag, nil
}

func (r *TagRepository) FindOrCreateTx(ctx context.Context, tx pgx.Tx, name string) (*model.Tag, error) {
	slug := pkg.Slugify(name)
	tag := &model.Tag{}

	err := tx.QueryRow(ctx,
		`INSERT INTO tags (name, slug) VALUES ($1, $2)
		 ON CONFLICT (slug) DO UPDATE SET name = tags.name
		 RETURNING id, name, slug, post_count`,
		name, slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.PostCount)
	if err != nil {
		return nil, fmt.Errorf("finding or creating tag: %w", err)
	}
	return tag, nil
}

func (r *TagRepository) UpdatePostCounts(ctx context.Context) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE tags SET post_count = (
			SELECT COUNT(*) FROM post_tags pt
			JOIN posts p ON p.id = pt.post_id
			WHERE pt.tag_id = tags.id AND p.status = 'published'
		)`)
	return err
}

// ---------------------------------------------------------------------------
// Tag suggestion methods (for autotag ML service)
// ---------------------------------------------------------------------------

// GetAllTagNames returns all tag names in the platform, ordered by popularity.
// Used for fuzzy matching in the ML service.
func (r *TagRepository) GetAllTagNames(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT name FROM tags ORDER BY post_count DESC LIMIT 500`)
	if err != nil {
		return nil, fmt.Errorf("query tags: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, nil
}

// UpsertSuggestedTag inserts or updates an ML-suggested tag for a post.
func (r *TagRepository) UpsertSuggestedTag(
	ctx context.Context,
	postID, keyword string,
	score float64,
	isExistingTag bool,
	matchedTag string,
) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO post_tag_suggestions (post_id, keyword, score, is_existing_tag, matched_tag)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''))
		ON CONFLICT (post_id, keyword)
		DO UPDATE SET
			score           = EXCLUDED.score,
			is_existing_tag = EXCLUDED.is_existing_tag,
			matched_tag     = EXCLUDED.matched_tag
	`, postID, keyword, score, isExistingTag, matchedTag)
	return err
}

// MarkSuggestionAccepted marks a tag suggestion as accepted or dismissed.
func (r *TagRepository) MarkSuggestionAccepted(ctx context.Context, postID, keyword string, accepted bool) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE post_tag_suggestions
		SET accepted = $3, accepted_at = NOW()
		WHERE post_id = $1 AND keyword = $2
	`, postID, keyword, accepted)
	return err
}

// GetSuggestionsForPost returns all ML-suggested tags for a post.
func (r *TagRepository) GetSuggestionsForPost(ctx context.Context, postID string) ([]model.PostTagSuggestion, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, post_id, keyword, score, is_existing_tag, matched_tag, accepted, accepted_at, created_at
		FROM post_tag_suggestions
		WHERE post_id = $1
		ORDER BY score DESC
	`, postID)
	if err != nil {
		return nil, fmt.Errorf("query suggestions: %w", err)
	}
	defer rows.Close()

	var suggestions []model.PostTagSuggestion
	for rows.Next() {
		var s model.PostTagSuggestion
		if err := rows.Scan(
			&s.ID, &s.PostID, &s.Keyword, &s.Score,
			&s.IsExistingTag, &s.MatchedTag, &s.Accepted,
			&s.AcceptedAt, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning suggestion: %w", err)
		}
		suggestions = append(suggestions, s)
	}
	return suggestions, nil
}
