package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
)

type AnalyticsRepository struct {
	pool *pgxpool.Pool
}

func NewAnalyticsRepository(pool *pgxpool.Pool) *AnalyticsRepository {
	return &AnalyticsRepository{pool: pool}
}

func (r *AnalyticsRepository) RecordView(ctx context.Context, postID, viewerIP, referrer, source, userAgent string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO post_views (post_id, viewer_ip, referrer, source, user_agent)
		 VALUES ($1, $2, $3, $4, $5)`,
		postID, viewerIP, referrer, source, userAgent,
	)
	if err != nil {
		return err
	}

	// Upsert daily stats
	isAI := 0
	if source == "agent" || source == "mcp" {
		isAI = 1
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO post_stats (post_id, view_date, view_count, unique_views, ai_view_count)
		 VALUES ($1, CURRENT_DATE, 1, 1, $2)
		 ON CONFLICT (post_id, view_date) DO UPDATE SET
		   view_count = post_stats.view_count + 1,
		   ai_view_count = post_stats.ai_view_count + $2`,
		postID, isAI,
	)
	return err
}

func (r *AnalyticsRepository) GetOverview(ctx context.Context, userID string) (*model.StatsOverview, error) {
	s := &model.StatsOverview{}

	// View stats
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(ps.view_count), 0), COALESCE(SUM(ps.unique_views), 0), COALESCE(SUM(ps.ai_view_count), 0)
		 FROM post_stats ps JOIN posts p ON p.id = ps.post_id
		 WHERE p.author_id = $1`, userID,
	).Scan(&s.TotalViews, &s.UniqueViews, &s.AIViews)
	if err != nil {
		return nil, err
	}

	// Post count
	r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM posts WHERE author_id = $1 AND status = 'published'`, userID,
	).Scan(&s.TotalPosts)

	// Like count
	r.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(p.like_count), 0) FROM posts p WHERE p.author_id = $1`, userID,
	).Scan(&s.TotalLikes)

	// Follower count
	r.pool.QueryRow(ctx,
		`SELECT follower_count FROM users WHERE id = $1`, userID,
	).Scan(&s.TotalFollows)

	return s, nil
}

func (r *AnalyticsRepository) GetViewsByDate(ctx context.Context, userID string, days int) ([]model.ViewsByDate, error) {
	if days < 1 {
		days = 30
	}

	rows, err := r.pool.Query(ctx,
		`SELECT ps.view_date::text, SUM(ps.view_count), SUM(ps.unique_views), SUM(ps.ai_view_count)
		 FROM post_stats ps JOIN posts p ON p.id = ps.post_id
		 WHERE p.author_id = $1 AND ps.view_date >= CURRENT_DATE - $2 * INTERVAL '1 day'
		 GROUP BY ps.view_date
		 ORDER BY ps.view_date ASC`, userID, days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []model.ViewsByDate
	for rows.Next() {
		var v model.ViewsByDate
		if err := rows.Scan(&v.Date, &v.ViewCount, &v.UniqueViews, &v.AIViews); err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, nil
}

func (r *AnalyticsRepository) GetTopPosts(ctx context.Context, userID string, days, limit int) ([]model.PostStatsDetail, error) {
	if limit < 1 {
		limit = 10
	}
	if days < 1 {
		days = 30
	}

	rows, err := r.pool.Query(ctx,
		`SELECT p.id, p.title, p.slug,
		        COALESCE(SUM(ps.view_count), 0) as views,
		        COALESCE(SUM(ps.unique_views), 0) as uniques,
		        p.like_count
		 FROM posts p
		 LEFT JOIN post_stats ps ON ps.post_id = p.id AND ps.view_date >= CURRENT_DATE - $2 * INTERVAL '1 day'
		 WHERE p.author_id = $1 AND p.status = 'published'
		 GROUP BY p.id, p.title, p.slug, p.like_count
		 ORDER BY views DESC
		 LIMIT $3`, userID, days, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []model.PostStatsDetail
	for rows.Next() {
		var s model.PostStatsDetail
		if err := rows.Scan(&s.PostID, &s.Title, &s.Slug, &s.ViewCount, &s.UniqueViews, &s.LikeCount); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

func (r *AnalyticsRepository) GetReferrers(ctx context.Context, userID string, days, limit int) ([]model.ReferrerStat, error) {
	if limit < 1 {
		limit = 10
	}
	if days < 1 {
		days = 30
	}

	rows, err := r.pool.Query(ctx,
		`SELECT COALESCE(NULLIF(pv.referrer, ''), 'direct') as ref, COUNT(*) as cnt
		 FROM post_views pv JOIN posts p ON p.id = pv.post_id
		 WHERE p.author_id = $1 AND pv.viewed_at >= NOW() - $2 * INTERVAL '1 day'
		 GROUP BY ref
		 ORDER BY cnt DESC
		 LIMIT $3`, userID, days, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []model.ReferrerStat
	for rows.Next() {
		var s model.ReferrerStat
		if err := rows.Scan(&s.Referrer, &s.Count); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}
