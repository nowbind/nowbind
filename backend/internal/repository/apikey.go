package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type ApiKeyRepository struct {
	pool *pgxpool.Pool
}

func NewApiKeyRepository(pool *pgxpool.Pool) *ApiKeyRepository {
	return &ApiKeyRepository{pool: pool}
}

// Create generates a new API key and returns the full key (only shown once) and the model.
func (r *ApiKeyRepository) Create(ctx context.Context, userID string, scopes []string, rateLimit int) (string, *model.ApiKey, error) {
	// Generate random key
	keyBytes := make([]byte, 32)
	if _, err := rand.Read(keyBytes); err != nil {
		return "", nil, fmt.Errorf("generating key: %w", err)
	}
	fullKey := "nb_" + hex.EncodeToString(keyBytes)
	prefix := fullKey[:7] + "..." // "nb_xxxx..."

	hash := sha256.Sum256([]byte(fullKey))
	keyHash := hex.EncodeToString(hash[:])

	apiKey := &model.ApiKey{
		UserID:    userID,
		KeyHash:   keyHash,
		KeyPrefix: prefix,
		Scopes:    scopes,
		RateLimit: rateLimit,
	}

	err := r.pool.QueryRow(ctx,
		`INSERT INTO api_keys (user_id, key_hash, key_prefix, scopes, rate_limit)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at`,
		apiKey.UserID, apiKey.KeyHash, apiKey.KeyPrefix, apiKey.Scopes, apiKey.RateLimit,
	).Scan(&apiKey.ID, &apiKey.CreatedAt)
	if err != nil {
		return "", nil, fmt.Errorf("creating api key: %w", err)
	}

	return fullKey, apiKey, nil
}

func (r *ApiKeyRepository) ListByUser(ctx context.Context, userID string) ([]model.ApiKey, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, key_prefix, scopes, rate_limit, expires_at, created_at, last_used_at
		 FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing api keys: %w", err)
	}
	defer rows.Close()

	var keys []model.ApiKey
	for rows.Next() {
		var k model.ApiKey
		if err := rows.Scan(&k.ID, &k.UserID, &k.KeyPrefix, &k.Scopes, &k.RateLimit,
			&k.ExpiresAt, &k.CreatedAt, &k.LastUsedAt); err != nil {
			return nil, fmt.Errorf("scanning api key: %w", err)
		}
		keys = append(keys, k)
	}
	return keys, nil
}

func (r *ApiKeyRepository) Delete(ctx context.Context, id, userID string) error {
	_, err := r.pool.Exec(ctx,
		"DELETE FROM api_keys WHERE id = $1 AND user_id = $2", id, userID)
	return err
}
