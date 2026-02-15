package service

import (
	"context"
	"fmt"
	"log"

	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
)

type SocialService struct {
	follows       *repository.FollowRepository
	likes         *repository.LikeRepository
	bookmarks     *repository.BookmarkRepository
	comments      *repository.CommentRepository
	notifications *repository.NotificationRepository
	users         *repository.UserRepository
	posts         *repository.PostRepository
}

func NewSocialService(
	follows *repository.FollowRepository,
	likes *repository.LikeRepository,
	bookmarks *repository.BookmarkRepository,
	comments *repository.CommentRepository,
	notifications *repository.NotificationRepository,
	users *repository.UserRepository,
	posts *repository.PostRepository,
) *SocialService {
	return &SocialService{
		follows:       follows,
		likes:         likes,
		bookmarks:     bookmarks,
		comments:      comments,
		notifications: notifications,
		users:         users,
		posts:         posts,
	}
}

func (s *SocialService) Follow(ctx context.Context, followerID, followingUsername string) error {
	target, err := s.users.GetByUsername(ctx, followingUsername)
	if err != nil || target == nil {
		return fmt.Errorf("user not found")
	}
	if followerID == target.ID {
		return fmt.Errorf("cannot follow yourself")
	}

	isNew, err := s.follows.Follow(ctx, followerID, target.ID)
	if err != nil {
		return err
	}

	// Only create notification for new follows (not re-follows)
	if isNew {
		go func() {
			n := &model.Notification{
				UserID:  target.ID,
				Type:    "new_follower",
				ActorID: &followerID,
			}
			if err := s.notifications.Create(context.Background(), n); err != nil {
				log.Printf("failed to create follow notification: %v", err)
			}
		}()
	}

	return nil
}

func (s *SocialService) Unfollow(ctx context.Context, followerID, followingUsername string) error {
	target, err := s.users.GetByUsername(ctx, followingUsername)
	if err != nil || target == nil {
		return fmt.Errorf("user not found")
	}
	return s.follows.Unfollow(ctx, followerID, target.ID)
}

func (s *SocialService) Like(ctx context.Context, userID, postID string) error {
	isNew, err := s.likes.Like(ctx, userID, postID)
	if err != nil {
		return err
	}

	// Only create notification for new likes (not re-likes)
	if isNew {
		go func() {
			post, err := s.posts.GetByID(context.Background(), postID)
			if err != nil || post == nil || post.AuthorID == userID {
				return
			}
			n := &model.Notification{
				UserID:  post.AuthorID,
				Type:    "new_like",
				ActorID: &userID,
				PostID:  &postID,
			}
			if err := s.notifications.Create(context.Background(), n); err != nil {
				log.Printf("failed to create like notification: %v", err)
			}
		}()
	}

	return nil
}

func (s *SocialService) Unlike(ctx context.Context, userID, postID string) error {
	return s.likes.Unlike(ctx, userID, postID)
}

func (s *SocialService) CreateComment(ctx context.Context, comment *model.Comment) error {
	if err := s.comments.Create(ctx, comment); err != nil {
		return err
	}

	// Create notification for post author
	go func() {
		post, err := s.posts.GetByID(context.Background(), comment.PostID)
		if err != nil || post == nil || post.AuthorID == comment.AuthorID {
			return
		}
		n := &model.Notification{
			UserID:    post.AuthorID,
			Type:      "new_comment",
			ActorID:   &comment.AuthorID,
			PostID:    &comment.PostID,
			CommentID: &comment.ID,
		}
		if err := s.notifications.Create(context.Background(), n); err != nil {
			log.Printf("failed to create comment notification: %v", err)
		}
	}()

	return nil
}
