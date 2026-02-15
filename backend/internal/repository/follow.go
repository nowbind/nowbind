package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type FollowRepository struct {
	pool *pgxpool.Pool
}

func NewFollowRepository(pool *pgxpool.Pool) *FollowRepository {
	return &FollowRepository{pool: pool}
}

func (r *FollowRepository) Follow(ctx context.Context, followerID, followingID string) (bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		followerID, followingID,
	)
	if err != nil {
		return false, fmt.Errorf("inserting follow: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return false, nil // already following
	}

	_, err = tx.Exec(ctx,
		`UPDATE users SET following_count = following_count + 1 WHERE id = $1`, followerID)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx,
		`UPDATE users SET follower_count = follower_count + 1 WHERE id = $1`, followingID)
	if err != nil {
		return false, err
	}

	return true, tx.Commit(ctx)
}

func (r *FollowRepository) Unfollow(ctx context.Context, followerID, followingID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
		followerID, followingID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil // not following
	}

	_, err = tx.Exec(ctx,
		`UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = $1`, followerID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx,
		`UPDATE users SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = $1`, followingID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *FollowRepository) IsFollowing(ctx context.Context, followerID, followingID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)`,
		followerID, followingID,
	).Scan(&exists)
	return exists, err
}

func (r *FollowRepository) GetFollowers(ctx context.Context, userID string, page, perPage int) ([]model.User, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM follows WHERE following_id = $1`, userID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT u.id, u.email, u.username, u.display_name, u.bio, u.avatar_url,
		        u.follower_count, u.following_count, f.created_at
		 FROM follows f JOIN users u ON u.id = f.follower_id
		 WHERE f.following_id = $1
		 ORDER BY f.created_at DESC
		 LIMIT $2 OFFSET $3`, userID, perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		var followedAt interface{}
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Bio,
			&u.AvatarURL, &u.FollowerCount, &u.FollowingCount, &followedAt); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, nil
}

func (r *FollowRepository) GetFollowing(ctx context.Context, userID string, page, perPage int) ([]model.User, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM follows WHERE follower_id = $1`, userID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT u.id, u.email, u.username, u.display_name, u.bio, u.avatar_url,
		        u.follower_count, u.following_count, f.created_at
		 FROM follows f JOIN users u ON u.id = f.following_id
		 WHERE f.follower_id = $1
		 ORDER BY f.created_at DESC
		 LIMIT $2 OFFSET $3`, userID, perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		var followedAt interface{}
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Bio,
			&u.AvatarURL, &u.FollowerCount, &u.FollowingCount, &followedAt); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, nil
}

func (r *FollowRepository) GetFollowingIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT following_id FROM follows WHERE follower_id = $1`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}
