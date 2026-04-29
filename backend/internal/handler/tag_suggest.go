// backend/internal/handler/tag_suggest.go
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/moderation"
	"github.com/nowbind/nowbind/internal/service"
)

// ---------------------------------------------------------------------------
// POST /api/v1/posts/{id}/suggest-tags
// ---------------------------------------------------------------------------

type suggestTagsRequest struct {
	Title         string   `json:"title"`
	Excerpt       string   `json:"excerpt"`
	ContentSample string   `json:"content_sample"`
	SelectedTags  []string `json:"selected_tags"`
}

type suggestTagsResponse struct {
	Suggestions []moderation.TagSuggestion `json:"suggestions"`
	Source      string                     `json:"source"`
}

// SuggestTags calls the ML service to generate tag suggestions from post content.
func (h *PostHandler) SuggestTags(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")

	// Validate that postID is a UUID (not a slug)
	if _, err := uuid.Parse(postID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}

	// Verify the authenticated user owns this post
	userID := middleware.GetUserID(r.Context())
	post, err := h.postRepo.GetByID(r.Context(), postID)
	if err != nil || post == nil {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}
	if post.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not your post")
		return
	}

	var req suggestTagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	result, err := h.tagSuggestionService.SuggestTags(r.Context(), service.SuggestTagsInput{
		PostID:        postID,
		Title:         req.Title,
		Excerpt:       req.Excerpt,
		ContentSample: req.ContentSample,
		SelectedTags:  req.SelectedTags,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate suggestions")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestTagsResponse{
		Suggestions: result.Suggestions,
		Source:      result.Source,
	})
}

// ---------------------------------------------------------------------------
// POST /api/v1/posts/{id}/suggest-tags/accept
// ---------------------------------------------------------------------------

type acceptSuggestionRequest struct {
	Keyword  string `json:"keyword"`
	Accepted bool   `json:"accepted"` // true = user clicked it, false = dismissed
}

// AcceptTagSuggestion marks a suggestion as accepted or dismissed.
func (h *PostHandler) AcceptTagSuggestion(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")
	if _, err := uuid.Parse(postID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}

	// Verify the authenticated user owns this post
	userID := middleware.GetUserID(r.Context())
	post, err := h.postRepo.GetByID(r.Context(), postID)
	if err != nil || post == nil {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}
	if post.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not your post")
		return
	}

	var req acceptSuggestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	_ = h.tagSuggestionService.AcceptSuggestion(r.Context(), postID, req.Keyword, req.Accepted)

	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// GET /api/v1/posts/{id}/suggestions
// ---------------------------------------------------------------------------

// GetSuggestions returns persisted tag suggestions for a post (for editor reload/draft resumption).
func (h *PostHandler) GetSuggestions(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")
	if _, err := uuid.Parse(postID); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"suggestions": []interface{}{}})
		return
	}

	// Verify the authenticated user owns this post
	userID := middleware.GetUserID(r.Context())
	post, err := h.postRepo.GetByID(r.Context(), postID)
	if err != nil || post == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"suggestions": []interface{}{}})
		return
	}
	if post.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not your post")
		return
	}

	suggestions, err := h.tagSuggestionService.GetSuggestions(r.Context(), postID)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"suggestions": []interface{}{}})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"suggestions": suggestions,
	})
}
