package service

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/nowbind/nowbind/internal/config"
	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
)

type MediaService struct {
	s3Client  *s3.Client
	bucket    string
	publicURL string
	repo      *repository.MediaRepository
}

func NewMediaService(cfg *config.Config, repo *repository.MediaRepository) *MediaService {
	ms := &MediaService{
		repo: repo,
	}

	if cfg.R2AccountID != "" && cfg.R2AccessKeyID != "" && cfg.R2SecretKey != "" {
		ms.s3Client = s3.New(s3.Options{
			Region: "auto",
			BaseEndpoint: aws.String(
				fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID),
			),
			Credentials: credentials.NewStaticCredentialsProvider(
				cfg.R2AccessKeyID, cfg.R2SecretKey, "",
			),
		})
		ms.bucket = cfg.R2BucketName
		ms.publicURL = cfg.R2PublicURL
	}

	return ms
}

func (s *MediaService) Upload(ctx context.Context, userID string, file io.Reader, originalName string, mimeType string, size int64) (*model.Media, error) {
	if s.s3Client == nil {
		return nil, fmt.Errorf("media storage is not configured — set R2 credentials")
	}

	ext := filepath.Ext(originalName)
	if ext == "" {
		ext = mimeExtension(mimeType)
	}

	now := time.Now()
	fileID := uuid.New().String()
	key := fmt.Sprintf("uploads/%s/%d/%02d/%s%s", userID, now.Year(), now.Month(), fileID, ext)

	_, err := s.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String(mimeType),
	})
	if err != nil {
		return nil, fmt.Errorf("uploading to R2: %w", err)
	}

	url := fmt.Sprintf("%s/%s", strings.TrimRight(s.publicURL, "/"), key)

	media := &model.Media{
		UserID:       userID,
		Filename:     fileID + ext,
		OriginalName: originalName,
		MimeType:     mimeType,
		SizeBytes:    size,
		URL:          url,
		R2Key:        key,
	}

	if err := s.repo.Create(ctx, media); err != nil {
		return nil, fmt.Errorf("saving media record: %w", err)
	}

	return media, nil
}

func (s *MediaService) Delete(ctx context.Context, mediaID, userID string) error {
	if s.s3Client == nil {
		return fmt.Errorf("media storage is not configured")
	}

	media, err := s.repo.GetByID(ctx, mediaID)
	if err != nil {
		return err
	}
	if media == nil {
		return fmt.Errorf("media not found")
	}
	if media.UserID != userID {
		return fmt.Errorf("unauthorized")
	}

	_, err = s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(media.R2Key),
	})
	if err != nil {
		return fmt.Errorf("deleting from R2: %w", err)
	}

	return s.repo.Delete(ctx, mediaID)
}

func mimeExtension(mimeType string) string {
	switch mimeType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/svg+xml":
		return ".svg"
	case "video/mp4":
		return ".mp4"
	case "video/webm":
		return ".webm"
	case "audio/mpeg":
		return ".mp3"
	case "audio/ogg":
		return ".ogg"
	default:
		return ".bin"
	}
}
