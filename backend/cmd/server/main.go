package main

import (
	"context"
	"flag"
	"log"
	"time"

	"github.com/joho/godotenv"
	"github.com/nowbind/nowbind/internal/config"
	"github.com/nowbind/nowbind/internal/database"
	"github.com/nowbind/nowbind/internal/router"
	"github.com/nowbind/nowbind/internal/server"
)

func main() {
	migrateOnly := flag.Bool("migrate", false, "Run migrations and exit")
	flag.Parse()

	// Load .env file (ignore error if not found)
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL, database.DBMode(cfg.DBMode))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	log.Printf("Connected to database (mode: %s)", cfg.DBMode)

	// Run migrations
	if err := database.RunMigrations(context.Background(), pool); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Migrations complete")

	if *migrateOnly {
		return
	}

	// Create router
	r := router.New(pool, cfg)

	// Start server
	if err := server.Run(r, cfg.Port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
