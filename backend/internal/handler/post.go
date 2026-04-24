package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/moderation"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/internal/service"
)

type PostHandler struct {
	postService      *service.PostService
	postRepo         *repository.PostRepository
	socialH          *SocialHandler
	moderationClient *moderation.Client
	moderationRepo   *repository.ModerationRepository
}

func NewPostHandler(
	postService *service.PostService,
	postRepo *repository.PostRepository,
	socialH *SocialHandler,
	moderationClient *moderation.Client,
	moderationRepo *repository.ModerationRepository,
) *PostHandler {
	return &PostHandler{
		postService:      postService,
		postRepo:         postRepo,
		socialH:          socialH,
		moderationClient: moderationClient,
		moderationRepo:   moderationRepo,
	}
}

func (h *PostHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	params := repository.ListPostsParams{
		Status:  "published",
		TagSlug: r.URL.Query().Get("tag"),
		Page:    page,
		PerPage: perPage,
	}

	if author := r.URL.Query().Get("author"); author != "" {
		params.AuthorID = author
	}

	if featured := r.URL.Query().Get("featured"); featured == "true" {
		t := true
		params.Featured = &t
	} else if featured == "false" {
		f := false
		params.Featured = &f
	}

	posts, total, err := h.postRepo.List(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list posts")
		return
	}

	h.socialH.EnrichPostSlice(r, posts)

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":        posts,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

func (h *PostHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	post, err := h.postRepo.GetBySlug(r.Context(), slug)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get post")
		return
	}
	if post == nil {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}

	// Only show drafts to their author
	if post.Status == "draft" {
		userID := middleware.GetUserID(r.Context())
		if userID != post.AuthorID {
			writeError(w, http.StatusNotFound, "post not found")
			return
		}
	}

	h.socialH.EnrichPost(r, post)

	writeJSON(w, http.StatusOK, post)
}

func (h *PostHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var input service.CreatePostInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	post, err := h.postService.Create(r.Context(), userID, input)
	if err != nil {
		writeError(w, http.StatusBadRequest, safePostError(err))
		return
	}

	writeJSON(w, http.StatusCreated, post)
}

func (h *PostHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	var input service.UpdatePostInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// If the post is already published, moderate the incoming content before saving
	if h.moderationClient != nil {
		existing, err := h.postRepo.GetByID(r.Context(), postID)
		if err == nil && existing != nil && existing.Status == "published" && existing.AuthorID == userID {
			// Extract the actual body text for moderation.
			// The frontend sends content_json (TipTap JSON), not content (plain text).
			bodyText := extractBodyText(input.Content, input.ContentJSON)
			text := input.Title + "\n" + input.Subtitle + "\n" + bodyText

			// Collect image URLs from body + feature image
			imageURLs := collectImageURLs(input.Content, input.ContentJSON)
			if input.FeatureImage != nil && *input.FeatureImage != "" {
				imageURLs = append(imageURLs, *input.FeatureImage)
			}

			if blocked := h.runModeration(w, r, "post", postID, text, imageURLs); blocked {
				return
			}
		}
	}

	post, err := h.postService.Update(r.Context(), postID, userID, input)
	if err != nil {
		if err.Error() == "unauthorized" {
			writeError(w, http.StatusForbidden, "not your post")
			return
		}
		if err.Error() == "post not found" {
			writeError(w, http.StatusNotFound, "post not found")
			return
		}
		writeError(w, http.StatusBadRequest, safePostError(err))
		return
	}

	writeJSON(w, http.StatusOK, post)
}

func (h *PostHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.postService.Delete(r.Context(), postID, userID); err != nil {
		writeError(w, http.StatusBadRequest, safePostError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PostHandler) Publish(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	// Fetch the post first for moderation
	post, err := h.postRepo.GetByID(r.Context(), postID)
	if err != nil || post == nil {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}
	if post.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not your post")
		return
	}

	// Run content moderation before publishing
	if h.moderationClient != nil {
		// Extract body text — prefer ContentJSON (TipTap) over Content (markdown)
		contentJSON := ""
		if post.ContentJSON != nil {
			contentJSON = *post.ContentJSON
		}
		bodyText := extractBodyText(post.Content, contentJSON)
		text := post.Title + "\n" + post.Subtitle + "\n" + bodyText

		// Collect image URLs from body AND the feature image
		imageURLs := collectImageURLs(post.Content, contentJSON)
		if post.FeatureImage != "" {
			imageURLs = append(imageURLs, post.FeatureImage)
		}

		if blocked := h.runModeration(w, r, "post", post.ID, text, imageURLs); blocked {
			return
		}
	}

	if err := h.postService.Publish(r.Context(), postID, userID); err != nil {
		writeError(w, http.StatusBadRequest, safePostError(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "published"})
}

// runModeration calls the moderation service and blocks/flags if needed.
// Returns true if the request was handled (blocked), false if content is safe.
func (h *PostHandler) runModeration(w http.ResponseWriter, r *http.Request, entityType, entityID, text string, imageURLs []string) bool {
	result, err := h.moderationClient.ModeratePost(r.Context(), entityID, text, imageURLs)
	if err != nil {
		// Moderation service is down — fail open (log and allow)
		log.Printf("moderation service unavailable: %v", err)
		return false
	}
	if !result.Safe {
		// Store moderation flags in DB
		if h.moderationRepo != nil {
			_ = h.moderationRepo.StoreModerationFlags(
				r.Context(), entityType, entityID, result.Action, result.Flags,
			)
		}

		if result.Action == "block" || result.Action == "flag_for_review" {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
				"error": result.Message,
			})
			return true
		}
	}
	return false
}

func (h *PostHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.postService.Unpublish(r.Context(), postID, userID); err != nil {
		writeError(w, http.StatusBadRequest, safePostError(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "draft"})
}

// ---------------------------------------------------------------------------
// Content extraction helpers for moderation
// ---------------------------------------------------------------------------

// extractBodyText returns the best available plain-text representation of the
// post body. If contentJSON (TipTap) is present, extract text from it;
// otherwise fall back to the raw markdown content string.
func extractBodyText(markdownContent, contentJSON string) string {
	if contentJSON != "" {
		text := extractTextFromTipTap(contentJSON)
		if text != "" {
			return text
		}
	}
	return markdownContent
}

// collectImageURLs extracts image URLs from both markdown and TipTap JSON.
func collectImageURLs(markdownContent, contentJSON string) []string {
	urls := extractMarkdownImageURLs(markdownContent)
	if contentJSON != "" {
		urls = append(urls, extractTipTapImageURLs(contentJSON)...)
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

// extractTextFromTipTap walks a TipTap JSON document and collects all text.
func extractTextFromTipTap(jsonContent string) string {
	var doc map[string]interface{}
	if err := json.Unmarshal([]byte(jsonContent), &doc); err != nil {
		return ""
	}
	var b strings.Builder
	walkTipTapText(doc, &b)
	return strings.TrimSpace(b.String())
}

func walkTipTapText(node map[string]interface{}, b *strings.Builder) {
	if text, ok := node["text"].(string); ok {
		b.WriteString(text)
	}
	if content, ok := node["content"].([]interface{}); ok {
		for _, child := range content {
			if childNode, ok := child.(map[string]interface{}); ok {
				walkTipTapText(childNode, b)
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

// extractTipTapImageURLs walks a TipTap JSON document and collects image src URLs.
func extractTipTapImageURLs(jsonContent string) []string {
	var doc map[string]interface{}
	if err := json.Unmarshal([]byte(jsonContent), &doc); err != nil {
		return nil
	}
	var urls []string
	walkTipTapImages(doc, &urls)
	return urls
}

func walkTipTapImages(node map[string]interface{}, urls *[]string) {
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
				walkTipTapImages(childNode, urls)
			}
		}
	}
}

// extractMarkdownImageURLs finds all markdown image URLs in the post content.
var imageURLRegex = regexp.MustCompile(`!\[.*?\]\((https?://[^\s)]+)\)`)

func extractMarkdownImageURLs(markdown string) []string {
	matches := imageURLRegex.FindAllStringSubmatch(markdown, -1)
	urls := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) > 1 {
			urls = append(urls, m[1])
		}
	}
	return urls
}
