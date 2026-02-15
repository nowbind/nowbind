package handler

import (
	"net/http"
	"strconv"

	"github.com/nowbind/nowbind/internal/repository"
)

type SearchHandler struct {
	posts *repository.PostRepository
}

func NewSearchHandler(posts *repository.PostRepository) *SearchHandler {
	return &SearchHandler{posts: posts}
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeError(w, http.StatusBadRequest, "query parameter 'q' is required")
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

	posts, total, err := h.posts.Search(r.Context(), query, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "search failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query": query,
		"posts": posts,
		"total": total,
	})
}

func (h *SearchHandler) Suggest(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	posts, err := h.posts.Suggest(r.Context(), query, 5)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "suggest failed")
		return
	}

	writeJSON(w, http.StatusOK, posts)
}
