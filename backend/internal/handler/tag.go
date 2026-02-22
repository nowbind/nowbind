package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/repository"
)

type TagHandler struct {
	tags    *repository.TagRepository
	posts   *repository.PostRepository
	socialH *SocialHandler
}

func NewTagHandler(tags *repository.TagRepository, posts *repository.PostRepository, socialH *SocialHandler) *TagHandler {
	return &TagHandler{tags: tags, posts: posts, socialH: socialH}
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	tags, total, err := h.tags.ListPaginated(r.Context(), page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tags")
		return
	}

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	w.Header().Set("X-Page", strconv.Itoa(page))
	w.Header().Set("X-Per-Page", strconv.Itoa(perPage))
	w.Header().Set("X-Total-Pages", strconv.Itoa(totalPages))
	writeJSON(w, http.StatusOK, tags)
}

func (h *TagHandler) GetPostsByTag(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	tag, err := h.tags.GetBySlug(r.Context(), slug)
	if err != nil || tag == nil {
		writeError(w, http.StatusNotFound, "tag not found")
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
		Status:  "published",
		TagSlug: slug,
		Page:    page,
		PerPage: perPage,
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
		"tag":         tag,
		"data":        posts,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}
