package service

import (
	"github.com/nowbind/nowbind/internal/repository"
)

type NotificationService struct {
	notifications *repository.NotificationRepository
	push          *repository.PushRepository
	vapidPublic   string
	vapidPrivate  string
}

func NewNotificationService(
	notifications *repository.NotificationRepository,
	push *repository.PushRepository,
	vapidPublic, vapidPrivate string,
) *NotificationService {
	return &NotificationService{
		notifications: notifications,
		push:          push,
		vapidPublic:   vapidPublic,
		vapidPrivate:  vapidPrivate,
	}
}

func (s *NotificationService) VAPIDPublicKey() string {
	return s.vapidPublic
}
