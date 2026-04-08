package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/pkg"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	user := &model.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, display_name, bio, avatar_url, oauth_provider, oauth_id,
		        follower_count, following_count, created_at, updated_at,
		        COALESCE(website, ''), COALESCE(twitter_url, ''), COALESCE(github_url, ''),
		        COALESCE(meta_title, ''), COALESCE(meta_description, '')
		 FROM users WHERE id = $1`, id,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.Bio,
		&user.AvatarURL, &user.OAuthProvider, &user.OAuthID,
		&user.FollowerCount, &user.FollowingCount, &user.CreatedAt, &user.UpdatedAt,
		&user.Website, &user.TwitterURL, &user.GitHubURL,
		&user.MetaTitle, &user.MetaDescription)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting user by id: %w", err)
	}
	applyGravatar(user)
	return user, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	user := &model.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, display_name, bio, avatar_url, oauth_provider, oauth_id,
		        follower_count, following_count, created_at, updated_at,
		        COALESCE(website, ''), COALESCE(twitter_url, ''), COALESCE(github_url, ''),
		        COALESCE(meta_title, ''), COALESCE(meta_description, '')
		 FROM users WHERE email = $1`, email,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.Bio,
		&user.AvatarURL, &user.OAuthProvider, &user.OAuthID,
		&user.FollowerCount, &user.FollowingCount, &user.CreatedAt, &user.UpdatedAt,
		&user.Website, &user.TwitterURL, &user.GitHubURL,
		&user.MetaTitle, &user.MetaDescription)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting user by email: %w", err)
	}
	applyGravatar(user)
	return user, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	user := &model.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, display_name, bio, avatar_url, oauth_provider, oauth_id,
		        follower_count, following_count, created_at, updated_at,
		        COALESCE(website, ''), COALESCE(twitter_url, ''), COALESCE(github_url, ''),
		        COALESCE(meta_title, ''), COALESCE(meta_description, '')
		 FROM users WHERE username = $1`, username,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.Bio,
		&user.AvatarURL, &user.OAuthProvider, &user.OAuthID,
		&user.FollowerCount, &user.FollowingCount, &user.CreatedAt, &user.UpdatedAt,
		&user.Website, &user.TwitterURL, &user.GitHubURL,
		&user.MetaTitle, &user.MetaDescription)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting user by username: %w", err)
	}
	applyGravatar(user)
	return user, nil
}

func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO users (email, username, display_name, bio, avatar_url, oauth_provider, oauth_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, created_at, updated_at`,
		user.Email, user.Username, user.DisplayName, user.Bio, user.AvatarURL,
		user.OAuthProvider, user.OAuthID,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

func (r *UserRepository) Update(ctx context.Context, user *model.User) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET display_name = $2, bio = $3, avatar_url = $4,
		        website = $5, twitter_url = $6, github_url = $7,
		        meta_title = $8, meta_description = $9,
		        updated_at = NOW()
		 WHERE id = $1`,
		user.ID, user.DisplayName, user.Bio, user.AvatarURL,
		user.Website, user.TwitterURL, user.GitHubURL,
		user.MetaTitle, user.MetaDescription,
	)
	return err
}

func (r *UserRepository) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func (r *UserRepository) UpsertByOAuth(ctx context.Context, user *model.User) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (email, username, display_name, avatar_url, oauth_provider, oauth_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (email) DO UPDATE SET
		   oauth_provider = EXCLUDED.oauth_provider,
		   oauth_id = EXCLUDED.oauth_id,
		   updated_at = NOW()
		 RETURNING id, username, display_name, avatar_url, created_at, updated_at`,
		user.Email, user.Username, user.DisplayName, user.AvatarURL,
		user.OAuthProvider, user.OAuthID,
	).Scan(&user.ID, &user.Username, &user.DisplayName, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return err
	}
	applyGravatar(user)
	return nil
}

func (r *UserRepository) ListAuthors(ctx context.Context) ([]model.User, error) {
	authors, _, err := r.ListAuthorsPaginated(ctx, 1, 50)
	return authors, err
}

func (r *UserRepository) ListAuthorsPaginated(ctx context.Context, page, perPage int) ([]model.User, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT u.id)
		 FROM users u
		 JOIN posts p ON p.author_id = u.id AND p.status = 'published'`,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT DISTINCT u.id, u.username, u.display_name, u.bio, u.avatar_url,
		        u.follower_count, u.following_count
		 FROM users u
		 JOIN posts p ON p.author_id = u.id AND p.status = 'published'
		 ORDER BY u.display_name ASC
		 LIMIT $1 OFFSET $2`,
		perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL,
			&u.FollowerCount, &u.FollowingCount); err != nil {
			return nil, 0, err
		}
		applyGravatar(&u)
		users = append(users, u)
	}
	return users, total, nil
}

func (r *UserRepository) SearchAuthors(ctx context.Context, query string, page, perPage int) ([]model.User, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	pattern := "%" + normalizedQuery + "%"

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM users u
		 WHERE LOWER(u.username) LIKE $1
		    OR LOWER(COALESCE(u.display_name, '')) LIKE $1`,
		pattern,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting author search results: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url,
		        u.follower_count, u.following_count
		 FROM users u
		 WHERE LOWER(u.username) LIKE $1
		    OR LOWER(COALESCE(u.display_name, '')) LIKE $1
		 ORDER BY
		   CASE
		     WHEN LOWER(u.username) = $4 THEN 0
		     WHEN LOWER(COALESCE(u.display_name, '')) = $4 THEN 1
		     WHEN LOWER(u.username) LIKE $5 THEN 2
		     WHEN LOWER(COALESCE(u.display_name, '')) LIKE $5 THEN 3
		     ELSE 4
		   END,
		   u.follower_count DESC,
		   u.display_name ASC,
		   u.username ASC
		 LIMIT $2 OFFSET $3`,
		pattern, perPage, offset, normalizedQuery, normalizedQuery+"%",
	)
	if err != nil {
		return nil, 0, fmt.Errorf("searching authors: %w", err)
	}
	defer rows.Close()

	users := make([]model.User, 0)
	for rows.Next() {
		var u model.User
		if err := rows.Scan(
			&u.ID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL,
			&u.FollowerCount, &u.FollowingCount,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning author search result: %w", err)
		}
		applyGravatar(&u)
		users = append(users, u)
	}

	return users, total, nil
}

func applyGravatar(user *model.User) {
	if user.AvatarURL == "" && user.Email != "" {
		user.AvatarURL = pkg.GravatarURL(user.Email, 200)
	}
}
