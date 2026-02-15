package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	DBMode      string // "local" | "neon"
	JWTSecret   string
	FrontendURL string
	Environment string // "development" | "production"

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string

	// GitHub OAuth
	GitHubClientID     string
	GitHubClientSecret string

	// Email (Gmail OAuth2)
	EmailSender       string
	GmailClientID     string
	GmailClientSecret string
	GmailRefreshToken string

	// Web Push (VAPID)
	VAPIDPublicKey  string
	VAPIDPrivateKey string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://nowbind:nowbind_dev@localhost:5432/nowbind?sslmode=disable"),
		DBMode:      getEnv("DB_MODE", ""),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-me-in-production"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),
		Environment: getEnv("ENVIRONMENT", "development"),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),

		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),

		EmailSender:       getEnv("EMAIL_SENDER", ""),
		GmailClientID:     getEnv("GMAIL_CLIENT_ID", ""),
		GmailClientSecret: getEnv("GMAIL_CLIENT_SECRET", ""),
		GmailRefreshToken: getEnv("GMAIL_REFRESH_TOKEN", ""),

		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
	}

	// Auto-detect DB mode from hostname if not set
	if cfg.DBMode == "" {
		if strings.Contains(cfg.DatabaseURL, "neon.tech") {
			cfg.DBMode = "neon"
		} else {
			cfg.DBMode = "local"
		}
	}

	// Default Gmail OAuth to Google OAuth credentials if not set separately
	if cfg.GmailClientID == "" {
		cfg.GmailClientID = cfg.GoogleClientID
	}
	if cfg.GmailClientSecret == "" {
		cfg.GmailClientSecret = cfg.GoogleClientSecret
	}

	if cfg.JWTSecret == "dev-secret-change-me-in-production" && cfg.Environment == "production" {
		return nil, fmt.Errorf("JWT_SECRET must be set in production")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
