package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lib/pq"
	"github.com/nowbind/nowbind/internal/model"
)

type PasskeyRepository struct {
	pool *pgxpool.Pool
}

func NewPasskeyRepository(pool *pgxpool.Pool) *PasskeyRepository {
	return &PasskeyRepository{pool: pool}
}

func (r *PasskeyRepository) CreateCredential(ctx context.Context, cred *model.PasskeyCredential) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO passkey_credentials (user_id, credential_id, public_key, aaguid, sign_count, name, transports)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, created_at`,
		cred.UserID, cred.CredentialID, cred.PublicKey, cred.AAGUID, cred.SignCount, cred.Name, pq.Array(cred.Transports),
	).Scan(&cred.ID, &cred.CreatedAt)
}

func (r *PasskeyRepository) GetCredentialByID(ctx context.Context, credentialID []byte) (*model.PasskeyCredential, error) {
	cred := &model.PasskeyCredential{}
	var transports pq.StringArray
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, credential_id, public_key, aaguid, sign_count, name, transports, created_at, last_used_at
		 FROM passkey_credentials WHERE credential_id = $1`,
		credentialID,
	).Scan(&cred.ID, &cred.UserID, &cred.CredentialID, &cred.PublicKey, &cred.AAGUID,
		&cred.SignCount, &cred.Name, &transports, &cred.CreatedAt, &cred.LastUsedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting credential: %w", err)
	}
	cred.Transports = transports
	return cred, nil
}

func (r *PasskeyRepository) GetCredentialsByUserID(ctx context.Context, userID string) ([]model.PasskeyCredential, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, credential_id, public_key, aaguid, sign_count, name, transports, created_at, last_used_at
		 FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying credentials: %w", err)
	}
	defer rows.Close()

	var creds []model.PasskeyCredential
	for rows.Next() {
		var cred model.PasskeyCredential
		var transports pq.StringArray
		if err := rows.Scan(&cred.ID, &cred.UserID, &cred.CredentialID, &cred.PublicKey, &cred.AAGUID,
			&cred.SignCount, &cred.Name, &transports, &cred.CreatedAt, &cred.LastUsedAt); err != nil {
			return nil, fmt.Errorf("scanning credential: %w", err)
		}
		cred.Transports = transports
		creds = append(creds, cred)
	}
	return creds, nil
}

func (r *PasskeyRepository) UpdateCredential(ctx context.Context, cred *model.PasskeyCredential) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE passkey_credentials SET sign_count = $2, last_used_at = $3 WHERE id = $1`,
		cred.ID, cred.SignCount, time.Now(),
	)
	return err
}

func (r *PasskeyRepository) DeleteCredential(ctx context.Context, id, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

func (r *PasskeyRepository) CreateChallenge(ctx context.Context, challenge *model.PasskeyChallenge) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO passkey_challenges (user_id, email, challenge, type, expires_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at`,
		challenge.UserID, challenge.Email, challenge.Challenge, challenge.Type, challenge.ExpiresAt,
	).Scan(&challenge.ID, &challenge.CreatedAt)
}

func (r *PasskeyRepository) GetChallenge(ctx context.Context, challengeBytes []byte) (*model.PasskeyChallenge, error) {
	ch := &model.PasskeyChallenge{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, email, challenge, type, created_at, expires_at
		 FROM passkey_challenges WHERE challenge = $1 AND expires_at > NOW()`,
		challengeBytes,
	).Scan(&ch.ID, &ch.UserID, &ch.Email, &ch.Challenge, &ch.Type, &ch.CreatedAt, &ch.ExpiresAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting challenge: %w", err)
	}
	return ch, nil
}

func (r *PasskeyRepository) DeleteChallenge(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM passkey_challenges WHERE id = $1`, id)
	return err
}

func (r *PasskeyRepository) CleanupExpiredChallenges(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM passkey_challenges WHERE expires_at < NOW()`)
	return err
}
