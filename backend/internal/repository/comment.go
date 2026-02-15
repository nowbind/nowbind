package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type CommentRepository struct {
	pool *pgxpool.Pool
}

func NewCommentRepository(pool *pgxpool.Pool) *CommentRepository {
	return &CommentRepository{pool: pool}
}

func (r *CommentRepository) Create(ctx context.Context, comment *model.Comment) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx,
		`INSERT INTO comments (post_id, author_id, parent_id, content)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, created_at, updated_at`,
		comment.PostID, comment.AuthorID, comment.ParentID, comment.Content,
	).Scan(&comment.ID, &comment.CreatedAt, &comment.UpdatedAt)
	if err != nil {
		return fmt.Errorf("inserting comment: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1`, comment.PostID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *CommentRepository) GetByID(ctx context.Context, id string) (*model.Comment, error) {
	c := &model.Comment{}
	author := &model.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT c.id, c.post_id, c.author_id, c.parent_id, c.content, c.created_at, c.updated_at,
		        u.id, u.username, u.display_name, u.avatar_url
		 FROM comments c JOIN users u ON u.id = c.author_id
		 WHERE c.id = $1`, id,
	).Scan(&c.ID, &c.PostID, &c.AuthorID, &c.ParentID, &c.Content, &c.CreatedAt, &c.UpdatedAt,
		&author.ID, &author.Username, &author.DisplayName, &author.AvatarURL)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	c.Author = author
	return c, nil
}

func (r *CommentRepository) Update(ctx context.Context, id, content string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE comments SET content = $2, updated_at = NOW() WHERE id = $1`,
		id, content,
	)
	return err
}

func (r *CommentRepository) Delete(ctx context.Context, id, postID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Count this comment + its replies to decrement
	var count int
	err = tx.QueryRow(ctx,
		`WITH RECURSIVE tree AS (
			SELECT id FROM comments WHERE id = $1
			UNION ALL
			SELECT c.id FROM comments c JOIN tree t ON c.parent_id = t.id
		) SELECT COUNT(*) FROM tree`, id,
	).Scan(&count)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `DELETE FROM comments WHERE id = $1`, id)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET comment_count = GREATEST(comment_count - $2, 0) WHERE id = $1`,
		postID, count)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *CommentRepository) GetByPost(ctx context.Context, postID string, page, perPage int) ([]model.Comment, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}

	// Count top-level comments
	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM comments WHERE post_id = $1 AND parent_id IS NULL`, postID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage

	// Fetch top-level comments
	rows, err := r.pool.Query(ctx,
		`SELECT c.id, c.post_id, c.author_id, c.parent_id, c.content, c.created_at, c.updated_at,
		        u.id, u.username, u.display_name, u.avatar_url
		 FROM comments c JOIN users u ON u.id = c.author_id
		 WHERE c.post_id = $1 AND c.parent_id IS NULL
		 ORDER BY c.created_at ASC
		 LIMIT $2 OFFSET $3`, postID, perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var comments []model.Comment
	var commentIDs []string
	commentMap := make(map[string]*model.Comment)

	for rows.Next() {
		var c model.Comment
		var author model.User
		if err := rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.ParentID, &c.Content, &c.CreatedAt, &c.UpdatedAt,
			&author.ID, &author.Username, &author.DisplayName, &author.AvatarURL); err != nil {
			return nil, 0, err
		}
		c.Author = &author
		c.Replies = []model.Comment{}
		comments = append(comments, c)
		commentIDs = append(commentIDs, c.ID)
	}

	// Build map after appending
	for i := range comments {
		commentMap[comments[i].ID] = &comments[i]
	}

	// Fetch replies for these top-level comments
	if len(commentIDs) > 0 {
		replyRows, err := r.pool.Query(ctx,
			`SELECT c.id, c.post_id, c.author_id, c.parent_id, c.content, c.created_at, c.updated_at,
			        u.id, u.username, u.display_name, u.avatar_url
			 FROM comments c JOIN users u ON u.id = c.author_id
			 WHERE c.parent_id = ANY($1)
			 ORDER BY c.created_at ASC`, commentIDs,
		)
		if err == nil {
			defer replyRows.Close()
			for replyRows.Next() {
				var c model.Comment
				var author model.User
				if err := replyRows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.ParentID, &c.Content, &c.CreatedAt, &c.UpdatedAt,
					&author.ID, &author.Username, &author.DisplayName, &author.AvatarURL); err == nil {
					c.Author = &author
					if c.ParentID != nil {
						if parent, ok := commentMap[*c.ParentID]; ok {
							parent.Replies = append(parent.Replies, c)
						}
					}
				}
			}
		}
	}

	return comments, total, nil
}

func (r *CommentRepository) CountByPost(ctx context.Context, postID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM comments WHERE post_id = $1`, postID,
	).Scan(&count)
	return count, err
}
