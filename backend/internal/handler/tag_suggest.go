// backend/internal/handler/tag_suggest.go
package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/moderation"
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

	var req suggestTagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if h.moderationClient == nil {
		// ML service not configured — return empty suggestions gracefully
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(suggestTagsResponse{Suggestions: []moderation.TagSuggestion{}})
		return
	}

	// Fetch all existing tag names from DB for fuzzy matching
	existingTags, err := h.tagRepo.GetAllTagNames(r.Context())
	if err != nil {
		log.Printf("SuggestTags: failed to get tags: %v", err)
		existingTags = []string{}
	}

	mlReq := moderation.TagSuggestionRequest{
		PostID:        postID,
		Title:         req.Title,
		Excerpt:       req.Excerpt,
		ContentSample: req.ContentSample,
		ExistingTags:  existingTags,
		SelectedTags:  req.SelectedTags,
	}

	result, err := h.moderationClient.SuggestTags(r.Context(), mlReq)
	if err != nil {
		// ML service unavailable — don't fail, return empty list
		log.Printf("SuggestTags: ml service error: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(suggestTagsResponse{Suggestions: []moderation.TagSuggestion{}})
		return
	}

	// Persist suggestions to DB (regardless of whether user accepts them)
	if len(result.Suggestions) > 0 {
		go storeSuggestions(h, postID, result.Suggestions)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestTagsResponse{
		Suggestions: result.Suggestions,
		Source:      result.Source,
	})
}

// storeSuggestions persists ML-suggested tags in the background.
func storeSuggestions(h *PostHandler, postID string, suggestions []moderation.TagSuggestion) {
	ctx := context.Background()
	for _, sug := range suggestions {
		matchedTag := ""
		if sug.MatchedTag != nil {
			matchedTag = *sug.MatchedTag
		}
		if err := h.tagRepo.UpsertSuggestedTag(ctx, postID, sug.Keyword, sug.Score, sug.IsExistingTag, matchedTag); err != nil {
			log.Printf("StoreSuggestedTags: %v", err)
		}
	}
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

	var req acceptSuggestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	if err := h.tagRepo.MarkSuggestionAccepted(r.Context(), postID, req.Keyword, req.Accepted); err != nil {
		log.Printf("AcceptTagSuggestion: %v", err)
	}

	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// GET /api/v1/posts/{id}/suggestions
// ---------------------------------------------------------------------------

// GetSuggestions returns persisted tag suggestions for a post (for editor reload/draft resumption).
func (h *PostHandler) GetSuggestions(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")

	suggestions, err := h.tagRepo.GetSuggestionsForPost(r.Context(), postID)
	if err != nil {
		log.Printf("GetSuggestions: %v", err)
		writeJSON(w, http.StatusOK, map[string]interface{}{"suggestions": []interface{}{}})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"suggestions": suggestions,
	})
}
