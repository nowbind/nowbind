package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/pkg"
)

type TagRepository struct {
	pool *pgxpool.Pool
}

func NewTagRepository(pool *pgxpool.Pool) *TagRepository {
	return &TagRepository{pool: pool}
}

func (r *TagRepository) List(ctx context.Context) ([]model.Tag, error) {
	tags, _, err := r.ListPaginated(ctx, 1, 50)
	return tags, err
}

func (r *TagRepository) ListPaginated(ctx context.Context, page, perPage int) ([]model.Tag, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	var total int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM tags").Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting tags: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, slug, post_count
		 FROM tags
		 ORDER BY post_count DESC, name ASC
		 LIMIT $1 OFFSET $2`,
		perPage, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("listing tags: %w", err)
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.PostCount); err != nil {
			return nil, 0, fmt.Errorf("scanning tag: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, total, nil
}

func (r *TagRepository) GetBySlug(ctx context.Context, slug string) (*model.Tag, error) {
	tag := &model.Tag{}
	err := r.pool.QueryRow(ctx,
		"SELECT id, name, slug, post_count FROM tags WHERE slug = $1", slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.PostCount)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting tag by slug: %w", err)
	}
	return tag, nil
}

func (r *TagRepository) FindOrCreate(ctx context.Context, name string) (*model.Tag, error) {
	slug := pkg.Slugify(name)
	tag := &model.Tag{}

	err := r.pool.QueryRow(ctx,
		`INSERT INTO tags (name, slug) VALUES ($1, $2)
		 ON CONFLICT (slug) DO UPDATE SET name = tags.name
		 RETURNING id, name, slug, post_count`,
		name, slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.PostCount)
	if err != nil {
		return nil, fmt.Errorf("finding or creating tag: %w", err)
	}
	return tag, nil
}

func (r *TagRepository) FindOrCreateTx(ctx context.Context, tx pgx.Tx, name string) (*model.Tag, error) {
	slug := pkg.Slugify(name)
	tag := &model.Tag{}

	err := tx.QueryRow(ctx,
		`INSERT INTO tags (name, slug) VALUES ($1, $2)
		 ON CONFLICT (slug) DO UPDATE SET name = tags.name
		 RETURNING id, name, slug, post_count`,
		name, slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.PostCount)
	if err != nil {
		return nil, fmt.Errorf("finding or creating tag: %w", err)
	}
	return tag, nil
}

func (r *TagRepository) UpdatePostCounts(ctx context.Context) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE tags SET post_count = (
			SELECT COUNT(*) FROM post_tags pt
			JOIN posts p ON p.id = pt.post_id
			WHERE pt.tag_id = tags.id AND p.status = 'published'
		)`)
	return err
}
