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

	// Email
	EmailProvider     string // "gmail" | "ses"
	EmailSender       string
	GmailClientID     string
	GmailClientSecret string
	GmailRefreshToken string

	// AWS SES
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	AWSRegion          string

	// Cookie domain for cross-subdomain sharing (e.g. ".nowbind.com")
	CookieDomain string

	// Web Push (VAPID)
	VAPIDPublicKey  string
	VAPIDPrivateKey string

	// Cloudflare R2 (S3-compatible)
	R2AccountID   string
	R2AccessKeyID string
	R2SecretKey   string
	R2BucketName  string
	R2PublicURL   string

	// Dev login – must be explicitly set to "true" to enable the dev-login endpoint
	DevLogin bool
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://nowbind:nowbind_dev@localhost:5432/nowbind?sslmode=disable"),
		DBMode:      getEnv("DB_MODE", ""),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),
		Environment: getEnv("ENVIRONMENT", "development"),

		CookieDomain: getEnv("COOKIE_DOMAIN", ""),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),

		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),

		EmailProvider:     getEnv("EMAIL_PROVIDER", "gmail"),
		EmailSender:       getEnv("EMAIL_SENDER", ""),
		GmailClientID:     getEnv("GMAIL_CLIENT_ID", ""),
		GmailClientSecret: getEnv("GMAIL_CLIENT_SECRET", ""),
		GmailRefreshToken: getEnv("GMAIL_REFRESH_TOKEN", ""),

		AWSAccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
		AWSRegion:          getEnv("AWS_REGION", "ap-south-1"),

		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),

		R2AccountID:   getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID: getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretKey:   getEnv("R2_SECRET_KEY", ""),
		R2BucketName:  getEnv("R2_BUCKET_NAME", ""),
		R2PublicURL:   getEnv("R2_PUBLIC_URL", ""),

		DevLogin: getEnv("DEV_LOGIN", "") == "true",
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

	if strings.TrimSpace(cfg.JWTSecret) == "" {
		return nil, fmt.Errorf("JWT_SECRET must be set")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
