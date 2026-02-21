package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/internal/service"
)

type PostHandler struct {
	postService *service.PostService
	postRepo    *repository.PostRepository
	socialH     *SocialHandler
}

func NewPostHandler(postService *service.PostService, postRepo *repository.PostRepository, socialH *SocialHandler) *PostHandler {
	return &PostHandler{postService: postService, postRepo: postRepo, socialH: socialH}
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
		writeError(w, http.StatusBadRequest, err.Error())
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

	post, err := h.postService.Update(r.Context(), postID, userID, input)
	if err != nil {
		if err.Error() == "unauthorized" {
			writeError(w, http.StatusForbidden, "not your post")
			return
		}
		if err.Error() == "post not found" {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, post)
}

func (h *PostHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.postService.Delete(r.Context(), postID, userID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PostHandler) Publish(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.postService.Publish(r.Context(), postID, userID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "published"})
}

func (h *PostHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.postService.Unpublish(r.Context(), postID, userID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "draft"})
}
