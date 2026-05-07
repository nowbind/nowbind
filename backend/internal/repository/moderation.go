package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/moderation"
)

// ModerationRepository handles persistence of moderation flags.
type ModerationRepository struct {
	pool *pgxpool.Pool
}

// NewModerationRepository creates a new ModerationRepository.
func NewModerationRepository(pool *pgxpool.Pool) *ModerationRepository {
	return &ModerationRepository{pool: pool}
}

// StoreModerationFlags inserts moderation flags for a given entity (post or comment)
// and updates the post's moderation_status if applicable.
func (r *ModerationRepository) StoreModerationFlags(
	ctx context.Context,
	entityType string, // "post" or "comment"
	entityID string,
	action string, // "block" or "flag_for_review"
	flags []moderation.ModerationFlag,
) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, f := range flags {
		_, err := tx.Exec(ctx,
			`INSERT INTO moderation_flags (entity_type, entity_id, label, score, threshold, action)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			entityType, entityID, f.Label, f.Score, f.Threshold, action,
		)
		if err != nil {
			return fmt.Errorf("insert flag: %w", err)
		}
	}

	// Update post moderation_status if this is a post
	if entityType == "post" {
		status := "flagged"
		if action == "block" {
			status = "blocked"
		}
		_, err := tx.Exec(ctx,
			`UPDATE posts SET moderation_status = $1 WHERE id = $2`,
			status, entityID,
		)
		if err != nil {
			return fmt.Errorf("update moderation status: %w", err)
		}
	}

	return tx.Commit(ctx)
}
