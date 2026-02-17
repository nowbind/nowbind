package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/repository"
)

type UserHandler struct {
	users   *repository.UserRepository
	posts   *repository.PostRepository
	follows *repository.FollowRepository
	socialH *SocialHandler
}

func NewUserHandler(users *repository.UserRepository, posts *repository.PostRepository, follows *repository.FollowRepository, socialH *SocialHandler) *UserHandler {
	return &UserHandler{users: users, posts: posts, follows: follows, socialH: socialH}
}

func (h *UserHandler) GetByUsername(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	user, err := h.users.GetByUsername(r.Context(), username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get user")
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	// Enrich with is_following if there's a logged-in user
	if meID := middleware.GetUserID(r.Context()); meID != "" && meID != user.ID {
		following, err := h.follows.IsFollowing(r.Context(), meID, user.ID)
		if err == nil {
			user.IsFollowing = following
		}
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *UserHandler) GetUserPosts(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	user, err := h.users.GetByUsername(r.Context(), username)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	posts, total, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:   "published",
		AuthorID: user.ID,
		Page:     page,
		PerPage:  perPage,
	})
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

func (h *UserHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	user, err := h.users.GetByID(r.Context(), userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	var input struct {
		DisplayName     string  `json:"display_name"`
		Bio             string  `json:"bio"`
		AvatarURL       string  `json:"avatar_url"`
		Website         *string `json:"website"`
		TwitterURL      *string `json:"twitter_url"`
		GitHubURL       *string `json:"github_url"`
		MetaTitle       *string `json:"meta_title"`
		MetaDescription *string `json:"meta_description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if dn := strings.TrimSpace(input.DisplayName); dn != "" {
		user.DisplayName = dn
	}
	if b := strings.TrimSpace(input.Bio); b != "" {
		user.Bio = b
	}
	if input.AvatarURL != "" {
		user.AvatarURL = input.AvatarURL
	}
	if input.Website != nil {
		user.Website = strings.TrimSpace(*input.Website)
	}
	if input.TwitterURL != nil {
		user.TwitterURL = strings.TrimSpace(*input.TwitterURL)
	}
	if input.GitHubURL != nil {
		user.GitHubURL = strings.TrimSpace(*input.GitHubURL)
	}
	if input.MetaTitle != nil {
		user.MetaTitle = strings.TrimSpace(*input.MetaTitle)
	}
	if input.MetaDescription != nil {
		user.MetaDescription = strings.TrimSpace(*input.MetaDescription)
	}

	if err := h.users.Update(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *UserHandler) ExportData(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	user, err := h.users.GetByID(r.Context(), userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	posts, _, err := h.posts.List(r.Context(), repository.ListPostsParams{
		AuthorID: userID,
		Page:     1,
		PerPage:  10000,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to export data")
		return
	}

	export := map[string]interface{}{
		"user":       user,
		"posts":      posts,
		"exported_at": time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=nowbind-export.json")
	json.NewEncoder(w).Encode(export)
}

func (h *UserHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input struct {
		Confirm string `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if input.Confirm != "DELETE" {
		writeError(w, http.StatusBadRequest, "please confirm with 'DELETE'")
		return
	}

	if err := h.users.Delete(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete account")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) MyPosts(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	status := r.URL.Query().Get("status")
	tagSlug := r.URL.Query().Get("tag")
	sort := r.URL.Query().Get("sort")

	posts, total, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:   status,
		AuthorID: userID,
		TagSlug:  tagSlug,
		Sort:     sort,
		Page:     page,
		PerPage:  perPage,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list posts")
		return
	}

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
