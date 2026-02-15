package pkg

import (
	"crypto/md5"
	"fmt"
	"strings"
)

// GravatarURL returns a Gravatar URL for the given email address.
// Uses identicon as the default fallback avatar.
func GravatarURL(email string, size int) string {
	if size <= 0 {
		size = 80
	}
	email = strings.TrimSpace(strings.ToLower(email))
	hash := md5.Sum([]byte(email))
	return fmt.Sprintf("https://www.gravatar.com/avatar/%x?d=identicon&s=%d", hash, size)
}
