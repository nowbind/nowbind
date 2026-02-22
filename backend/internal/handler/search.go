package handler

import (
	"net/http"
	"strconv"

	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/repository"
)

type SearchHandler struct {
	posts   *repository.PostRepository
	users   *repository.UserRepository
	follows *repository.FollowRepository
	socialH *SocialHandler
}

func NewSearchHandler(
	posts *repository.PostRepository,
	users *repository.UserRepository,
	follows *repository.FollowRepository,
	socialH *SocialHandler,
) *SearchHandler {
	return &SearchHandler{
		posts:   posts,
		users:   users,
		follows: follows,
		socialH: socialH,
	}
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

	h.socialH.EnrichPostSlice(r, posts)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query": query,
		"posts": posts,
		"total": total,
	})
}

func (h *SearchHandler) SearchAuthors(w http.ResponseWriter, r *http.Request) {
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
		perPage = 20
	}

	authors, total, err := h.users.SearchAuthors(r.Context(), query, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "author search failed")
		return
	}

	meID := middleware.GetUserID(r.Context())
	if meID != "" {
		for i := range authors {
			if authors[i].ID == meID {
				continue
			}
			following, err := h.follows.IsFollowing(r.Context(), meID, authors[i].ID)
			if err == nil {
				authors[i].IsFollowing = following
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query":   query,
		"authors": authors,
		"total":   total,
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
