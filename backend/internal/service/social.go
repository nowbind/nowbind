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
	notifService  *NotificationService
}

func NewSocialService(
	follows *repository.FollowRepository,
	likes *repository.LikeRepository,
	bookmarks *repository.BookmarkRepository,
	comments *repository.CommentRepository,
	notifications *repository.NotificationRepository,
	users *repository.UserRepository,
	posts *repository.PostRepository,
	notifService *NotificationService,
) *SocialService {
	return &SocialService{
		follows:       follows,
		likes:         likes,
		bookmarks:     bookmarks,
		comments:      comments,
		notifications: notifications,
		users:         users,
		posts:         posts,
		notifService:  notifService,
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
	if !isNew {
		return fmt.Errorf("already following")
	}

	go func() {
		bgCtx := context.Background()
		n := &model.Notification{
			UserID:  target.ID,
			Type:    "new_follower",
			ActorID: &followerID,
		}
		if err := s.notifications.Create(bgCtx, n); err != nil {
			log.Printf("failed to create follow notification: %v", err)
			return
		}

		// Send push notification
		actor, _ := s.users.GetByID(bgCtx, followerID)
		actorName := "Someone"
		if actor != nil {
			actorName = actor.DisplayName
			if actorName == "" {
				actorName = actor.Username
			}
		}
		s.notifService.SendPush(bgCtx, target.ID, PushPayload{
			Title: "New Follower",
			Body:  actorName + " started following you",
			URL:   "/notifications",
		})
	}()

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

	if isNew {
		go func() {
			bgCtx := context.Background()
			post, err := s.posts.GetByID(bgCtx, postID)
			if err != nil || post == nil || post.AuthorID == userID {
				return
			}
			n := &model.Notification{
				UserID:  post.AuthorID,
				Type:    "new_like",
				ActorID: &userID,
				PostID:  &postID,
			}
			if err := s.notifications.Create(bgCtx, n); err != nil {
				log.Printf("failed to create like notification: %v", err)
				return
			}

			// Send push notification
			actor, _ := s.users.GetByID(bgCtx, userID)
			actorName := "Someone"
			if actor != nil {
				actorName = actor.DisplayName
				if actorName == "" {
					actorName = actor.Username
				}
			}
			title := post.Title
			if len(title) > 50 {
				title = title[:50] + "..."
			}
			s.notifService.SendPush(bgCtx, post.AuthorID, PushPayload{
				Title: "New Like",
				Body:  actorName + " liked your post \"" + title + "\"",
				URL:   "/post/" + post.Slug,
			})
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

	go func() {
		bgCtx := context.Background()
		post, err := s.posts.GetByID(bgCtx, comment.PostID)
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
		if err := s.notifications.Create(bgCtx, n); err != nil {
			log.Printf("failed to create comment notification: %v", err)
			return
		}

		// Send push notification
		actor, _ := s.users.GetByID(bgCtx, comment.AuthorID)
		actorName := "Someone"
		if actor != nil {
			actorName = actor.DisplayName
			if actorName == "" {
				actorName = actor.Username
			}
		}
		title := post.Title
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		s.notifService.SendPush(bgCtx, post.AuthorID, PushPayload{
			Title: "New Comment",
			Body:  actorName + " commented on \"" + title + "\"",
			URL:   "/post/" + post.Slug,
		})
	}()

	return nil
}
