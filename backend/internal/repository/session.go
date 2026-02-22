package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
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

	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	session := &model.Session{
		RefreshToken: token,
		UserID:       userID,
		ExpiresAt:    time.Now().Add(30 * 24 * time.Hour),
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO sessions (refresh_token, user_id, expires_at) VALUES ($1, $2, $3)`,
		tokenHash, session.UserID, session.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating session: %w", err)
	}

	return session, nil
}

func (r *SessionRepository) GetByToken(ctx context.Context, token string) (*model.Session, error) {
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	session := &model.Session{}
	err := r.pool.QueryRow(ctx,
		`SELECT refresh_token, user_id, expires_at, created_at FROM sessions
		 WHERE refresh_token = $1 AND expires_at > NOW()`, tokenHash,
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
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])
	_, err := r.pool.Exec(ctx, "DELETE FROM sessions WHERE refresh_token = $1", tokenHash)
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
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	_, err = r.pool.Exec(ctx,
		`INSERT INTO magic_links (email, token_hash, expires_at) VALUES ($1, $2, $3)`,
		email, tokenHash, time.Now().Add(15*time.Minute),
	)
	if err != nil {
		return "", fmt.Errorf("creating magic link: %w", err)
	}

	return token, nil
}

func (r *SessionRepository) DeleteMagicLink(ctx context.Context, token string) error {
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	_, err := r.pool.Exec(ctx,
		`DELETE FROM magic_links
		 WHERE token_hash = $1 OR token = $2`,
		tokenHash, token,
	)
	return err
}

func (r *SessionRepository) VerifyMagicLink(ctx context.Context, token string) (string, error) {
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	var email string
	err := r.pool.QueryRow(ctx,
		`UPDATE magic_links SET used_at = NOW()
		 WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL
		 RETURNING email`, tokenHash,
	).Scan(&email)
	if err == pgx.ErrNoRows {
		// Backward compatibility for links created before token hashing rollout.
		err = r.pool.QueryRow(ctx,
			`UPDATE magic_links SET used_at = NOW(), token_hash = $2, token = NULL
			 WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL
			 RETURNING email`,
			token, tokenHash,
		).Scan(&email)
	}
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
