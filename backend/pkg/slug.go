package pkg

import (
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var (
	nonAlphanumeric = regexp.MustCompile(`[^a-z0-9-]`)
	multiDash       = regexp.MustCompile(`-{2,}`)
)

// Slugify converts a title to a URL-safe slug.
func Slugify(title string) string {
	// Normalize unicode
	s := norm.NFKD.String(title)

	// Lowercase
	s = strings.ToLower(s)

	// Remove non-ASCII
	var b strings.Builder
	for _, r := range s {
		if r <= unicode.MaxASCII {
			b.WriteRune(r)
		}
	}
	s = b.String()

	// Replace spaces and special chars with dashes
	s = strings.ReplaceAll(s, " ", "-")
	s = nonAlphanumeric.ReplaceAllString(s, "")
	s = multiDash.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")

	// Truncate to reasonable length
	if len(s) > 80 {
		s = s[:80]
		if idx := strings.LastIndex(s, "-"); idx > 40 {
			s = s[:idx]
		}
	}

	return s
}

// UniqueSlug appends a random suffix to make a slug unique.
func UniqueSlug(title string) string {
	slug := Slugify(title)
	suffix := make([]byte, 4)
	rand.Read(suffix)
	return slug + "-" + hex.EncodeToString(suffix)
}

// EstimateReadingTime estimates reading time in minutes based on word count.
func EstimateReadingTime(content string) int {
	words := strings.Fields(content)
	wpm := 200
	minutes := len(words) / wpm
	if minutes < 1 {
		return 1
	}
	return minutes
}
