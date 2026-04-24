package service

import (
	"context"
	"fmt"
	"io"
	"os"
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
	// Local file storage (development fallback when R2 is not configured)
	useLocal    bool
	localDir    string // e.g. "./uploads"
	localPrefix string // e.g. "http://localhost:8080/uploads"
}

func NewMediaService(cfg *config.Config, repo *repository.MediaRepository) *MediaService {
	ms := &MediaService{
		repo: repo,
	}

	// If R2 is configured, use Cloudflare R2 (production)
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
	} else {
		// Fall back to local file storage for development
		ms.useLocal = true
		ms.localDir = "./uploads"
		// Construct public URL: backend serves files at /uploads/...
		port := cfg.Port
		if port == "" {
			port = "8080"
		}
		ms.localPrefix = fmt.Sprintf("http://localhost:%s/uploads", port)
		// Ensure uploads directory exists
		os.MkdirAll(ms.localDir, 0755)
	}

	return ms
}

func (s *MediaService) Upload(ctx context.Context, userID string, file io.Reader, originalName string, mimeType string, size int64) (*model.Media, error) {
	ext := filepath.Ext(originalName)
	if ext == "" {
		ext = mimeExtension(mimeType)
	}

	now := time.Now()
	fileID := uuid.New().String()
	key := fmt.Sprintf("uploads/%s/%d/%02d/%s%s", userID, now.Year(), now.Month(), fileID, ext)

	if s.useLocal {
		return s.uploadLocal(ctx, userID, file, originalName, mimeType, size, key, fileID, ext)
	}
	return s.uploadR2(ctx, userID, file, originalName, mimeType, size, key, fileID, ext)
}

func (s *MediaService) uploadR2(ctx context.Context, userID string, file io.Reader, originalName string, mimeType string, size int64, key string, fileID string, ext string) (*model.Media, error) {
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

func (s *MediaService) uploadLocal(ctx context.Context, userID string, file io.Reader, originalName string, mimeType string, size int64, key string, fileID string, ext string) (*model.Media, error) {
	localPath := filepath.Join(s.localDir, key)

	// Ensure subdirectory exists
	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return nil, fmt.Errorf("creating upload directory: %w", err)
	}

	dst, err := os.Create(localPath)
	if err != nil {
		return nil, fmt.Errorf("creating local file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return nil, fmt.Errorf("writing local file: %w", err)
	}

	url := fmt.Sprintf("%s/%s", strings.TrimRight(s.localPrefix, "/"), key)

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

	if s.useLocal {
		// Delete local file
		localPath := filepath.Join(s.localDir, media.R2Key)
		os.Remove(localPath) // best-effort, ignore error
	} else {
		_, err = s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(s.bucket),
			Key:    aws.String(media.R2Key),
		})
		if err != nil {
			return fmt.Errorf("deleting from R2: %w", err)
		}
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
