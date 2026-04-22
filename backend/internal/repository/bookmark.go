package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type BookmarkRepository struct {
	pool *pgxpool.Pool
}

func NewBookmarkRepository(pool *pgxpool.Pool) *BookmarkRepository {
	return &BookmarkRepository{pool: pool}
}

func (r *BookmarkRepository) Add(ctx context.Context, userID, postID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, postID,
	)
	return err
}

func (r *BookmarkRepository) Remove(ctx context.Context, userID, postID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2`,
		userID, postID,
	)
	return err
}

func (r *BookmarkRepository) IsBookmarked(ctx context.Context, userID, postID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $1 AND post_id = $2)`,
		userID, postID,
	).Scan(&exists)
	return exists, err
}

func (r *BookmarkRepository) GetBookmarkedPostIDs(ctx context.Context, userID string, postIDs []string) (map[string]bool, error) {
	result := make(map[string]bool)
	if len(postIDs) == 0 {
		return result, nil
	}
	rows, err := r.pool.Query(ctx,
		`SELECT post_id FROM bookmarks WHERE user_id = $1 AND post_id = ANY($2)`,
		userID, postIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = true
	}
	return result, nil
}

func (r *BookmarkRepository) GetBookmarks(ctx context.Context, userID string, page, perPage int) ([]model.Post, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 10
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM bookmarks b JOIN posts p ON p.id = b.post_id
		 WHERE b.user_id = $1 AND p.status = 'published'`, userID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT p.id, p.author_id, p.slug, p.title, p.subtitle, p.excerpt, p.status,
		        p.reading_time, p.published_at, p.created_at, p.updated_at,
		        p.ai_keywords, p.like_count, p.comment_count,
		        u.id, u.email, u.username, u.display_name, u.avatar_url
		 FROM bookmarks b
		 JOIN posts p ON p.id = b.post_id
		 JOIN users u ON u.id = p.author_id
		 WHERE b.user_id = $1 AND p.status = 'published'
		 ORDER BY b.created_at DESC
		 LIMIT $2 OFFSET $3`, userID, perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var posts []model.Post
	for rows.Next() {
		var p model.Post
		var author model.User
		if err := rows.Scan(
			&p.ID, &p.AuthorID, &p.Slug, &p.Title, &p.Subtitle, &p.Excerpt, &p.Status,
			&p.ReadingTime, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt,
			&p.AIKeywords, &p.LikeCount, &p.CommentCount,
			&author.ID, &author.Email, &author.Username, &author.DisplayName, &author.AvatarURL,
		); err != nil {
			return nil, 0, err
		}
		p.Author = &author
		p.IsBookmarked = true
		posts = append(posts, p)
	}
	return posts, total, nil
}
