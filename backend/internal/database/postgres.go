package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DBMode string

const (
	DBModeLocal DBMode = "local"
	DBModeNeon  DBMode = "neon"
)

func NewPool(ctx context.Context, databaseURL string, mode DBMode) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing database URL: %w", err)
	}

	switch mode {
	case DBModeNeon:
		config.MaxConns = 10
		config.MinConns = 0
		config.MaxConnLifetime = 30 * time.Minute
		config.MaxConnIdleTime = 5 * time.Minute
		config.HealthCheckPeriod = 30 * time.Second
		config.ConnConfig.ConnectTimeout = 10 * time.Second

		config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
			_, err := conn.Exec(ctx, "SET statement_timeout = '30s'")
			return err
		}
	default: // local
		config.MaxConns = 25
		config.MinConns = 5
		config.MaxConnLifetime = 1 * time.Hour
		config.MaxConnIdleTime = 30 * time.Minute
		config.HealthCheckPeriod = 1 * time.Minute
		config.ConnConfig.ConnectTimeout = 5 * time.Second
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return pool, nil
}

// WithRetry retries a function once after a 500ms delay on connection errors (handles Neon cold starts).
func WithRetry[T any](ctx context.Context, fn func(ctx context.Context) (T, error)) (T, error) {
	result, err := fn(ctx)
	if err == nil {
		return result, nil
	}

	// Check if it's a connection error worth retrying
	if isConnectionError(err) {
		time.Sleep(500 * time.Millisecond)
		return fn(ctx)
	}

	return result, err
}

func isConnectionError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	for _, s := range []string{"connection refused", "connection reset", "broken pipe", "EOF", "timeout"} {
		if contains(msg, s) {
			return true
		}
	}
	return false
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
