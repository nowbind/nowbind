package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type PushRepository struct {
	pool *pgxpool.Pool
}

func NewPushRepository(pool *pgxpool.Pool) *PushRepository {
	return &PushRepository{pool: pool}
}

func (r *PushRepository) SaveSubscription(ctx context.Context, sub *model.PushSubscription) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (endpoint) DO UPDATE SET
		   user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
		 RETURNING id`,
		sub.UserID, sub.Endpoint, sub.P256dh, sub.Auth,
	).Scan(&sub.ID)
}

func (r *PushRepository) GetByUserID(ctx context.Context, userID string) ([]model.PushSubscription, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []model.PushSubscription
	for rows.Next() {
		var s model.PushSubscription
		if err := rows.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256dh, &s.Auth); err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *PushRepository) DeleteSubscription(ctx context.Context, endpoint, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`,
		endpoint, userID,
	)
	return err
}

func (r *PushRepository) GetPreferences(ctx context.Context, userID string) (*model.NotificationPreferences, error) {
	prefs := &model.NotificationPreferences{UserID: userID}
	err := r.pool.QueryRow(ctx,
		`SELECT new_follower, new_comment, new_like FROM notification_preferences WHERE user_id = $1`, userID,
	).Scan(&prefs.NewFollower, &prefs.NewComment, &prefs.NewLike)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Return defaults
			prefs.NewFollower = true
			prefs.NewComment = true
			prefs.NewLike = true
			return prefs, nil
		}
		return nil, err
	}
	return prefs, nil
}

func (r *PushRepository) SavePreferences(ctx context.Context, prefs *model.NotificationPreferences) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO notification_preferences (user_id, new_follower, new_comment, new_like, updated_at)
		 VALUES ($1, $2, $3, $4, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		   new_follower = EXCLUDED.new_follower,
		   new_comment = EXCLUDED.new_comment,
		   new_like = EXCLUDED.new_like,
		   updated_at = NOW()`,
		prefs.UserID, prefs.NewFollower, prefs.NewComment, prefs.NewLike,
	)
	return err
}
