package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type SessionRepository struct {
	pool *pgxpool.Pool
}

func NewSessionRepository(pool *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{pool: pool}
}

func (r *SessionRepository) Create(ctx context.Context, userID string) (*model.Session, error) {
	token, err := generateToken(32)
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	session := &model.Session{
		RefreshToken: token,
		UserID:       userID,
		ExpiresAt:    time.Now().Add(30 * 24 * time.Hour),
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO sessions (refresh_token, user_id, expires_at) VALUES ($1, $2, $3)`,
		session.RefreshToken, session.UserID, session.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating session: %w", err)
	}

	return session, nil
}

func (r *SessionRepository) GetByToken(ctx context.Context, token string) (*model.Session, error) {
	session := &model.Session{}
	err := r.pool.QueryRow(ctx,
		`SELECT refresh_token, user_id, expires_at, created_at FROM sessions
		 WHERE refresh_token = $1 AND expires_at > NOW()`, token,
	).Scan(&session.RefreshToken, &session.UserID, &session.ExpiresAt, &session.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting session: %w", err)
	}
	return session, nil
}

func (r *SessionRepository) Delete(ctx context.Context, token string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM sessions WHERE refresh_token = $1", token)
	return err
}

func (r *SessionRepository) DeleteByUserID(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM sessions WHERE user_id = $1", userID)
	return err
}

// MagicLink methods

func (r *SessionRepository) CreateMagicLink(ctx context.Context, email string) (string, error) {
	token, err := generateToken(32)
	if err != nil {
		return "", fmt.Errorf("generating magic link token: %w", err)
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO magic_links (email, token, expires_at) VALUES ($1, $2, $3)`,
		email, token, time.Now().Add(15*time.Minute),
	)
	if err != nil {
		return "", fmt.Errorf("creating magic link: %w", err)
	}

	return token, nil
}

func (r *SessionRepository) VerifyMagicLink(ctx context.Context, token string) (string, error) {
	var email string
	err := r.pool.QueryRow(ctx,
		`UPDATE magic_links SET used_at = NOW()
		 WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL
		 RETURNING email`, token,
	).Scan(&email)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", fmt.Errorf("invalid or expired magic link")
		}
		return "", fmt.Errorf("verifying magic link: %w", err)
	}
	return email, nil
}

func generateToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
