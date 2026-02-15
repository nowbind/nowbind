package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

const ApiKeyUserIDKey contextKey = "api_key_user_id"

func ApiKeyAuth(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := extractApiKey(r)
			if key == "" {
				http.Error(w, `{"error":"api key required"}`, http.StatusUnauthorized)
				return
			}

			hash := sha256.Sum256([]byte(key))
			keyHash := hex.EncodeToString(hash[:])

			var userID string
			err := pool.QueryRow(r.Context(),
				`SELECT user_id FROM api_keys WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
				keyHash,
			).Scan(&userID)

			if err != nil {
				http.Error(w, `{"error":"invalid api key"}`, http.StatusUnauthorized)
				return
			}

			// Update last_used_at
			go func() {
				pool.Exec(context.Background(),
					"UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1", keyHash)
			}()

			ctx := context.WithValue(r.Context(), ApiKeyUserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractApiKey(r *http.Request) string {
	if auth := r.Header.Get("Authorization"); auth != "" {
		if strings.HasPrefix(auth, "Bearer nb_") {
			return strings.TrimPrefix(auth, "Bearer ")
		}
	}
	if key := r.URL.Query().Get("api_key"); key != "" {
		return key
	}
	return ""
}
