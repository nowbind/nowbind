package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type PostRepository struct {
	pool *pgxpool.Pool
}

func NewPostRepository(pool *pgxpool.Pool) *PostRepository {
	return &PostRepository{pool: pool}
}

func (r *PostRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}

type ListPostsParams struct {
	Status    string
	AuthorID  string
	AuthorIDs []string
	TagSlug   string
	Featured  *bool
	Sort      string // "newest", "oldest", "updated"
	Page      int
	PerPage   int
}

func (r *PostRepository) List(ctx context.Context, params ListPostsParams) ([]model.Post, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PerPage < 1 {
		params.PerPage = 10
	}

	var conditions []string
	var args []interface{}
	argIdx := 1

	if params.Status != "" {
		conditions = append(conditions, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, params.Status)
		argIdx++
	}
	if params.AuthorID != "" {
		conditions = append(conditions, fmt.Sprintf("p.author_id = $%d", argIdx))
		args = append(args, params.AuthorID)
		argIdx++
	}
	if len(params.AuthorIDs) > 0 {
		conditions = append(conditions, fmt.Sprintf("p.author_id = ANY($%d)", argIdx))
		args = append(args, params.AuthorIDs)
		argIdx++
	}
	if params.TagSlug != "" {
		conditions = append(conditions, fmt.Sprintf(`EXISTS (
			SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
			WHERE pt.post_id = p.id AND t.slug = $%d
		)`, argIdx))
		args = append(args, params.TagSlug)
		argIdx++
	}
	if params.Featured != nil {
		conditions = append(conditions, fmt.Sprintf("p.featured = $%d", argIdx))
		args = append(args, *params.Featured)
		argIdx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM posts p %s", where)
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting posts: %w", err)
	}

	// Determine sort order
	orderBy := "COALESCE(p.published_at, p.created_at) DESC"
	switch params.Sort {
	case "oldest":
		orderBy = "COALESCE(p.published_at, p.created_at) ASC"
	case "updated":
		orderBy = "p.updated_at DESC"
	}

	// Fetch posts
	offset := (params.Page - 1) * params.PerPage
	args = append(args, params.PerPage, offset)

	query := fmt.Sprintf(`
		SELECT p.id, p.author_id, p.slug, p.title, p.subtitle, p.excerpt, p.status,
		       p.reading_time, p.published_at, p.created_at, p.updated_at,
		       p.ai_summary, p.ai_keywords, p.like_count, p.comment_count,
		       p.content_json, p.content_format, COALESCE(p.feature_image, ''), p.featured,
		       u.id, u.email, u.username, u.display_name, u.avatar_url
		FROM posts p
		JOIN users u ON u.id = p.author_id
		%s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, where, orderBy, argIdx, argIdx+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing posts: %w", err)
	}
	defer rows.Close()

	var posts []model.Post
	for rows.Next() {
		var p model.Post
		var author model.User
		if err := rows.Scan(
			&p.ID, &p.AuthorID, &p.Slug, &p.Title, &p.Subtitle, &p.Excerpt, &p.Status,
			&p.ReadingTime, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt,
			&p.AISummary, &p.AIKeywords, &p.LikeCount, &p.CommentCount,
			&p.ContentJSON, &p.ContentFormat, &p.FeatureImage, &p.Featured,
			&author.ID, &author.Email, &author.Username, &author.DisplayName, &author.AvatarURL,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning post: %w", err)
		}
		p.Author = &author
		posts = append(posts, p)
	}

	// Load tags for all posts
	if len(posts) > 0 {
		postIDs := make([]string, len(posts))
		postMap := make(map[string]*model.Post)
		for i := range posts {
			postIDs[i] = posts[i].ID
			postMap[posts[i].ID] = &posts[i]
		}

		tagRows, err := r.pool.Query(ctx,
			`SELECT pt.post_id, t.id, t.name, t.slug, t.post_count
			 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
			 WHERE pt.post_id = ANY($1)`, postIDs,
		)
		if err == nil {
			defer tagRows.Close()
			for tagRows.Next() {
				var postID string
				var tag model.Tag
				if err := tagRows.Scan(&postID, &tag.ID, &tag.Name, &tag.Slug, &tag.PostCount); err == nil {
					if p, ok := postMap[postID]; ok {
						p.Tags = append(p.Tags, tag)
					}
				}
			}
		}
	}

	return posts, total, nil
}

func (r *PostRepository) ListTagsByAuthor(ctx context.Context, authorID string) ([]model.Tag, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.name, t.slug, COUNT(*)::INT AS post_count
		 FROM tags t
		 JOIN post_tags pt ON pt.tag_id = t.id
		 JOIN posts p ON p.id = pt.post_id
		 WHERE p.author_id = $1
		 GROUP BY t.id, t.name, t.slug
		 ORDER BY post_count DESC, t.name ASC`,
		authorID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing author tags: %w", err)
	}
	defer rows.Close()

	tags := make([]model.Tag, 0)
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.PostCount); err != nil {
			return nil, fmt.Errorf("scanning author tag: %w", err)
		}
		tags = append(tags, t)
	}

	return tags, nil
}

func (r *PostRepository) GetBySlug(ctx context.Context, slug string) (*model.Post, error) {
	p := &model.Post{}
	author := &model.User{}

	err := r.pool.QueryRow(ctx,
		`SELECT p.id, p.author_id, p.slug, p.title, p.subtitle, p.content, p.excerpt,
		        p.status, p.reading_time, p.published_at, p.created_at, p.updated_at,
		        p.ai_summary, p.ai_keywords, p.structured_md, p.like_count, p.comment_count,
		        p.content_json, p.content_format, COALESCE(p.feature_image, ''), p.featured,
		        u.id, u.email, u.username, u.display_name, u.avatar_url
		 FROM posts p JOIN users u ON u.id = p.author_id
		 WHERE p.slug = $1`, slug,
	).Scan(
		&p.ID, &p.AuthorID, &p.Slug, &p.Title, &p.Subtitle, &p.Content, &p.Excerpt,
		&p.Status, &p.ReadingTime, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt,
		&p.AISummary, &p.AIKeywords, &p.StructuredMD, &p.LikeCount, &p.CommentCount,
		&p.ContentJSON, &p.ContentFormat, &p.FeatureImage, &p.Featured,
		&author.ID, &author.Email, &author.Username, &author.DisplayName, &author.AvatarURL,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting post by slug: %w", err)
	}
	p.Author = author

	// Load tags
	tagRows, err := r.pool.Query(ctx,
		`SELECT t.id, t.name, t.slug, t.post_count
		 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
		 WHERE pt.post_id = $1`, p.ID,
	)
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tag model.Tag
			if err := tagRows.Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.PostCount); err == nil {
				p.Tags = append(p.Tags, tag)
			}
		}
	}

	return p, nil
}

func (r *PostRepository) GetByID(ctx context.Context, id string) (*model.Post, error) {
	p := &model.Post{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, author_id, slug, title, subtitle, content, excerpt, status,
		        reading_time, published_at, created_at, updated_at,
		        ai_summary, ai_keywords, structured_md,
		        content_json, content_format, COALESCE(feature_image, ''), featured
		 FROM posts WHERE id = $1`, id,
	).Scan(
		&p.ID, &p.AuthorID, &p.Slug, &p.Title, &p.Subtitle, &p.Content, &p.Excerpt,
		&p.Status, &p.ReadingTime, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt,
		&p.AISummary, &p.AIKeywords, &p.StructuredMD,
		&p.ContentJSON, &p.ContentFormat, &p.FeatureImage, &p.Featured,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting post by id: %w", err)
	}
	return p, nil
}

func (r *PostRepository) Create(ctx context.Context, post *model.Post) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO posts (author_id, slug, title, subtitle, content, excerpt, status, reading_time, ai_summary, ai_keywords, structured_md, content_json, content_format, feature_image, featured)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		 RETURNING id, created_at, updated_at`,
		post.AuthorID, post.Slug, post.Title, post.Subtitle, post.Content,
		post.Excerpt, post.Status, post.ReadingTime,
		post.AISummary, post.AIKeywords, post.StructuredMD,
		post.ContentJSON, post.ContentFormat, post.FeatureImage, post.Featured,
	).Scan(&post.ID, &post.CreatedAt, &post.UpdatedAt)
}

func (r *PostRepository) CreateTx(ctx context.Context, tx pgx.Tx, post *model.Post) error {
	return tx.QueryRow(ctx,
		`INSERT INTO posts (author_id, slug, title, subtitle, content, excerpt, status, reading_time, ai_summary, ai_keywords, structured_md, content_json, content_format, feature_image, featured)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		 RETURNING id, created_at, updated_at`,
		post.AuthorID, post.Slug, post.Title, post.Subtitle, post.Content,
		post.Excerpt, post.Status, post.ReadingTime,
		post.AISummary, post.AIKeywords, post.StructuredMD,
		post.ContentJSON, post.ContentFormat, post.FeatureImage, post.Featured,
	).Scan(&post.ID, &post.CreatedAt, &post.UpdatedAt)
}

func (r *PostRepository) Update(ctx context.Context, post *model.Post) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE posts SET title = $2, subtitle = $3, content = $4, excerpt = $5,
		        slug = $6, reading_time = $7, ai_summary = $8, ai_keywords = $9,
		        structured_md = $10, content_json = $11, content_format = $12,
		        feature_image = $13, featured = $14,
		        updated_at = NOW()
		 WHERE id = $1`,
		post.ID, post.Title, post.Subtitle, post.Content, post.Excerpt,
		post.Slug, post.ReadingTime, post.AISummary, post.AIKeywords, post.StructuredMD,
		post.ContentJSON, post.ContentFormat, post.FeatureImage, post.Featured,
	)
	return err
}

func (r *PostRepository) IsSlugTaken(ctx context.Context, slug string, excludePostID string) (bool, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM posts WHERE slug = $1 AND id != $2`, slug, excludePostID,
	).Scan(&count)
	return count > 0, err
}

func (r *PostRepository) HasTags(ctx context.Context, postID string) (bool, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM post_tags WHERE post_id = $1`, postID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("checking post tags: %w", err)
	}
	return count > 0, nil
}

func (r *PostRepository) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM posts WHERE id = $1", id)
	return err
}

func (r *PostRepository) Publish(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE posts SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1", id)
	return err
}

func (r *PostRepository) Unpublish(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE posts SET status = 'draft', published_at = NULL, updated_at = NOW() WHERE id = $1", id)
	return err
}

func (r *PostRepository) SetTags(ctx context.Context, postID string, tagIDs []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := r.SetTagsTx(ctx, tx, postID, tagIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PostRepository) SetTagsTx(ctx context.Context, tx pgx.Tx, postID string, tagIDs []string) error {
	// Remove existing tags
	if _, err := tx.Exec(ctx, "DELETE FROM post_tags WHERE post_id = $1", postID); err != nil {
		return err
	}

	// Insert new tags
	for _, tagID := range tagIDs {
		if _, err := tx.Exec(ctx,
			"INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			postID, tagID,
		); err != nil {
			return err
		}
	}

	return nil
}

// Search performs full-text search on posts
func (r *PostRepository) Search(ctx context.Context, query string, page, perPage int) ([]model.Post, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 10
	}

	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM posts WHERE status = 'published' AND search_vector @@ plainto_tsquery('english', $1)`,
		query,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting search results: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT p.id, p.author_id, p.slug, p.title, p.subtitle, p.excerpt, p.status,
		        p.reading_time, p.published_at, p.created_at, p.updated_at,
		        p.ai_summary, p.ai_keywords, p.like_count, p.comment_count,
		        p.content_json, p.content_format,
		        u.id, u.email, u.username, u.display_name, u.avatar_url,
		        ts_rank(p.search_vector, plainto_tsquery('english', $1)) AS rank
		 FROM posts p JOIN users u ON u.id = p.author_id
		 WHERE p.status = 'published' AND p.search_vector @@ plainto_tsquery('english', $1)
		 ORDER BY rank DESC
		 LIMIT $2 OFFSET $3`,
		query, perPage, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("searching posts: %w", err)
	}
	defer rows.Close()

	var posts []model.Post
	for rows.Next() {
		var p model.Post
		var author model.User
		var rank float64
		if err := rows.Scan(
			&p.ID, &p.AuthorID, &p.Slug, &p.Title, &p.Subtitle, &p.Excerpt, &p.Status,
			&p.ReadingTime, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt,
			&p.AISummary, &p.AIKeywords, &p.LikeCount, &p.CommentCount,
			&p.ContentJSON, &p.ContentFormat,
			&author.ID, &author.Email, &author.Username, &author.DisplayName, &author.AvatarURL,
			&rank,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning search result: %w", err)
		}
		p.Author = &author
		posts = append(posts, p)
	}

	return posts, total, nil
}

func (r *PostRepository) GetRelated(ctx context.Context, postID string, limit int) ([]model.Post, error) {
	if limit < 1 {
		limit = 3
	}
	rows, err := r.pool.Query(ctx,
		`SELECT p.id, p.slug, p.title, p.subtitle, p.excerpt, p.reading_time,
		        p.published_at, p.like_count, p.comment_count,
		        u.id, u.username, u.display_name, u.avatar_url
		 FROM posts p
		 JOIN users u ON u.id = p.author_id
		 WHERE p.status = 'published' AND p.id != $1
		   AND EXISTS (
		     SELECT 1 FROM post_tags pt1
		     JOIN post_tags pt2 ON pt2.tag_id = pt1.tag_id AND pt2.post_id = $1
		     WHERE pt1.post_id = p.id
		   )
		 ORDER BY p.published_at DESC NULLS LAST
		 LIMIT $2`, postID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []model.Post
	for rows.Next() {
		var p model.Post
		var author model.User
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Subtitle, &p.Excerpt, &p.ReadingTime,
			&p.PublishedAt, &p.LikeCount, &p.CommentCount,
			&author.ID, &author.Username, &author.DisplayName, &author.AvatarURL); err != nil {
			return nil, err
		}
		p.Author = &author
		posts = append(posts, p)
	}
	return posts, nil
}

func (r *PostRepository) GetTrending(ctx context.Context, days, limit int) ([]model.Post, error) {
	if days < 1 {
		days = 7
	}
	if limit < 1 {
		limit = 5
	}

	rows, err := r.pool.Query(ctx,
		`SELECT p.id, p.slug, p.title, p.subtitle, p.excerpt, p.reading_time,
		        p.published_at, p.like_count, p.comment_count,
		        u.id, u.username, u.display_name, u.avatar_url,
		        COALESCE(SUM(ps.view_count), 0) as views
		 FROM posts p
		 JOIN users u ON u.id = p.author_id
		 LEFT JOIN post_stats ps ON ps.post_id = p.id AND ps.view_date >= CURRENT_DATE - $1 * INTERVAL '1 day'
		 WHERE p.status = 'published'
		 GROUP BY p.id, u.id
		 ORDER BY views DESC, p.like_count DESC
		 LIMIT $2`, days, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := make([]model.Post, 0)
	for rows.Next() {
		var p model.Post
		var author model.User
		var views int
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Subtitle, &p.Excerpt, &p.ReadingTime,
			&p.PublishedAt, &p.LikeCount, &p.CommentCount,
			&author.ID, &author.Username, &author.DisplayName, &author.AvatarURL,
			&views); err != nil {
			return nil, err
		}
		p.Author = &author
		posts = append(posts, p)
	}
	return posts, nil
}

func (r *PostRepository) Suggest(ctx context.Context, query string, limit int) ([]model.Post, error) {
	if limit < 1 {
		limit = 5
	}

	rows, err := r.pool.Query(ctx,
		`SELECT id, slug, title, excerpt
		 FROM posts
		 WHERE status = 'published' AND title % $1
		 ORDER BY similarity(title, $1) DESC
		 LIMIT $2`,
		query, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("suggesting posts: %w", err)
	}
	defer rows.Close()

	var posts []model.Post
	for rows.Next() {
		var p model.Post
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Excerpt); err != nil {
			return nil, fmt.Errorf("scanning suggestion: %w", err)
		}
		posts = append(posts, p)
	}
	return posts, nil
}
