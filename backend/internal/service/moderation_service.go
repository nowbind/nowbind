package service

import (
	"context"
	"encoding/json"
	"log"
	"regexp"
	"strings"

	"github.com/nowbind/nowbind/internal/moderation"
	"github.com/nowbind/nowbind/internal/repository"
)

// ModerationService encapsulates content-moderation business logic.
type ModerationService struct {
	client *moderation.Client
	repo   *repository.ModerationRepository
}

// NewModerationService creates a ModerationService.
// client may be nil if the moderation service URL is not configured.
func NewModerationService(client *moderation.Client, repo *repository.ModerationRepository) *ModerationService {
	return &ModerationService{client: client, repo: repo}
}

// Enabled returns true when the moderation ML service is configured.
func (s *ModerationService) Enabled() bool {
	return s.client != nil
}

// ModerationOutcome describes the result of a moderation check.
type ModerationOutcome struct {
	Blocked bool
	Message string
}

// ModerateContent calls the moderation service for the given entity.
// Returns (blocked=true, message) when the content should be rejected.
// On service errors the method fails open (returns blocked=false) and logs the error.
func (s *ModerationService) ModerateContent(
	ctx context.Context,
	entityType string, // "post" or "comment"
	entityID string,
	text string,
	imageURLs []string,
) ModerationOutcome {
	if s.client == nil {
		return ModerationOutcome{}
	}

	result, err := s.client.ModeratePost(ctx, entityID, text, imageURLs)
	if err != nil {
		// Moderation service is down — fail open (log and allow)
		log.Printf("moderation service unavailable: %v", err)
		return ModerationOutcome{}
	}

	if !result.Safe {
		// Store moderation flags in DB
		if s.repo != nil {
			if err := s.repo.StoreModerationFlags(ctx, entityType, entityID, result.Action, result.Flags); err != nil {
				log.Printf("failed to store moderation flags for %s %s: %v", entityType, entityID, err)
			}
		}

		if result.Action == "block" || result.Action == "flag_for_review" {
			return ModerationOutcome{Blocked: true, Message: result.Message}
		}
	}
	return ModerationOutcome{}
}

// ModerateComment is a convenience wrapper for comment moderation.
func (s *ModerationService) ModerateComment(ctx context.Context, commentID, text string) ModerationOutcome {
	if s.client == nil {
		return ModerationOutcome{}
	}

	result, err := s.client.ModerateComment(ctx, commentID, text)
	if err != nil {
		log.Printf("moderation service unavailable for comment: %v", err)
		return ModerationOutcome{}
	}

	if !result.Safe {
		return ModerationOutcome{Blocked: true, Message: result.Message}
	}
	return ModerationOutcome{}
}

// ---------------------------------------------------------------------------
// Content extraction helpers (moved from handler/post.go)
// ---------------------------------------------------------------------------

// ExtractBodyText returns the best available plain-text representation of the
// post body. If contentJSON (TipTap) is present, extract text from it;
// otherwise fall back to the raw markdown content string.
func ExtractBodyText(markdownContent, contentJSON string) string {
	if contentJSON != "" {
		text := extractTextFromTipTapMod(contentJSON)
		if text != "" {
			return text
		}
	}
	return markdownContent
}

// CollectImageURLs extracts image URLs from both markdown and TipTap JSON.
func CollectImageURLs(markdownContent, contentJSON string) []string {
	urls := extractMarkdownImageURLsMod(markdownContent)
	if contentJSON != "" {
		urls = append(urls, extractTipTapImageURLsMod(contentJSON)...)
	}
	// Deduplicate
	seen := make(map[string]bool, len(urls))
	deduped := make([]string, 0, len(urls))
	for _, u := range urls {
		if !seen[u] {
			seen[u] = true
			deduped = append(deduped, u)
		}
	}
	return deduped
}

// extractTextFromTipTapMod walks a TipTap JSON document and collects all text.
func extractTextFromTipTapMod(jsonContent string) string {
	var doc map[string]interface{}
	if err := json.Unmarshal([]byte(jsonContent), &doc); err != nil {
		return ""
	}
	var b strings.Builder
	walkTipTapTextMod(doc, &b)
	return strings.TrimSpace(b.String())
}

func walkTipTapTextMod(node map[string]interface{}, b *strings.Builder) {
	if text, ok := node["text"].(string); ok {
		b.WriteString(text)
	}
	if content, ok := node["content"].([]interface{}); ok {
		for _, child := range content {
			if childNode, ok := child.(map[string]interface{}); ok {
				walkTipTapTextMod(childNode, b)
			}
		}
	}
	// Add newlines after block-level nodes
	nodeType, _ := node["type"].(string)
	switch nodeType {
	case "paragraph", "heading", "blockquote", "codeBlock", "bulletList",
		"orderedList", "listItem", "horizontalRule", "callout":
		b.WriteString("\n")
	}
}

// extractTipTapImageURLsMod walks a TipTap JSON document and collects image src URLs.
func extractTipTapImageURLsMod(jsonContent string) []string {
	var doc map[string]interface{}
	if err := json.Unmarshal([]byte(jsonContent), &doc); err != nil {
		return nil
	}
	var urls []string
	walkTipTapImagesMod(doc, &urls)
	return urls
}

func walkTipTapImagesMod(node map[string]interface{}, urls *[]string) {
	nodeType, _ := node["type"].(string)

	// TipTap image node: {"type":"image","attrs":{"src":"https://..."}}
	if nodeType == "image" {
		if attrs, ok := node["attrs"].(map[string]interface{}); ok {
			if src, ok := attrs["src"].(string); ok && src != "" {
				*urls = append(*urls, src)
			}
		}
	}

	// Recurse into children
	if content, ok := node["content"].([]interface{}); ok {
		for _, child := range content {
			if childNode, ok := child.(map[string]interface{}); ok {
				walkTipTapImagesMod(childNode, urls)
			}
		}
	}
}

// extractMarkdownImageURLsMod finds all markdown image URLs in the post content.
var imageURLRegexMod = regexp.MustCompile(`!\[.*?\]\((https?://[^\s)]+)\)`)

func extractMarkdownImageURLsMod(markdown string) []string {
	matches := imageURLRegexMod.FindAllStringSubmatch(markdown, -1)
	urls := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) > 1 {
			urls = append(urls, m[1])
		}
	}
	return urls
}
