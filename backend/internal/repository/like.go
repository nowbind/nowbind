package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type LikeRepository struct {
	pool *pgxpool.Pool
}

func NewLikeRepository(pool *pgxpool.Pool) *LikeRepository {
	return &LikeRepository{pool: pool}
}

func (r *LikeRepository) Like(ctx context.Context, userID, postID string) (bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, postID,
	)
	if err != nil {
		return false, fmt.Errorf("inserting like: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return false, nil // already liked
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET like_count = like_count + 1 WHERE id = $1`, postID)
	if err != nil {
		return false, err
	}

	return true, tx.Commit(ctx)
}

func (r *LikeRepository) Unlike(ctx context.Context, userID, postID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2`,
		userID, postID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1`, postID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *LikeRepository) IsLiked(ctx context.Context, userID, postID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM post_likes WHERE user_id = $1 AND post_id = $2)`,
		userID, postID,
	).Scan(&exists)
	return exists, err
}

func (r *LikeRepository) GetLikedPostIDs(ctx context.Context, userID string, postIDs []string) (map[string]bool, error) {
	result := make(map[string]bool)
	if len(postIDs) == 0 {
		return result, nil
	}
	rows, err := r.pool.Query(ctx,
		`SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2)`,
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

func (r *LikeRepository) GetLikedPosts(ctx context.Context, userID string, page, perPage int) ([]model.Post, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 10
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM post_likes pl JOIN posts p ON p.id = pl.post_id
		 WHERE pl.user_id = $1 AND p.status = 'published'`, userID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT p.id, p.author_id, p.slug, p.title, p.subtitle, p.excerpt, p.status,
		        p.reading_time, p.published_at, p.created_at, p.updated_at,
		        p.ai_keywords, p.like_count, p.comment_count,
		        u.id, u.email, u.username, u.display_name, u.avatar_url
		 FROM post_likes pl
		 JOIN posts p ON p.id = pl.post_id
		 JOIN users u ON u.id = p.author_id
		 WHERE pl.user_id = $1 AND p.status = 'published'
		 ORDER BY pl.created_at DESC
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
		p.IsLiked = true
		posts = append(posts, p)
	}
	return posts, total, nil
}
