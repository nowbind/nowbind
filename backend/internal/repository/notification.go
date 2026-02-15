package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type NotificationRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{pool: pool}
}

func (r *NotificationRepository) Create(ctx context.Context, n *model.Notification) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at`,
		n.UserID, n.Type, n.ActorID, n.PostID, n.CommentID,
	).Scan(&n.ID, &n.CreatedAt)
}

func (r *NotificationRepository) GetByUser(ctx context.Context, userID string, page, perPage int) ([]model.Notification, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1`, userID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT n.id, n.user_id, n.type, n.actor_id, n.post_id, n.comment_id, n.read, n.created_at,
		        a.id, a.username, a.display_name, a.avatar_url,
		        p.id, p.title, p.slug
		 FROM notifications n
		 LEFT JOIN users a ON a.id = n.actor_id
		 LEFT JOIN posts p ON p.id = n.post_id
		 WHERE n.user_id = $1
		 ORDER BY n.created_at DESC
		 LIMIT $2 OFFSET $3`, userID, perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var notifications []model.Notification
	for rows.Next() {
		var n model.Notification
		var actorID, actorUsername, actorDisplayName, actorAvatar *string
		var postID, postTitle, postSlug *string

		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Type, &n.ActorID, &n.PostID, &n.CommentID, &n.Read, &n.CreatedAt,
			&actorID, &actorUsername, &actorDisplayName, &actorAvatar,
			&postID, &postTitle, &postSlug,
		); err != nil {
			return nil, 0, err
		}

		if actorID != nil {
			n.Actor = &model.User{
				ID:          *actorID,
				Username:    deref(actorUsername),
				DisplayName: deref(actorDisplayName),
				AvatarURL:   deref(actorAvatar),
			}
		}
		if postID != nil {
			n.Post = &model.Post{
				ID:    *postID,
				Title: deref(postTitle),
				Slug:  deref(postSlug),
			}
		}

		notifications = append(notifications, n)
	}

	return notifications, total, nil
}

func (r *NotificationRepository) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`, userID,
	).Scan(&count)
	return count, err
}

func (r *NotificationRepository) MarkRead(ctx context.Context, id, userID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

func (r *NotificationRepository) MarkAllRead(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`, userID,
	)
	return err
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
