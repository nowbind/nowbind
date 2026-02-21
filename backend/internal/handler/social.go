package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/internal/service"
)

type SocialHandler struct {
	social    *service.SocialService
	follows   *repository.FollowRepository
	likes     *repository.LikeRepository
	bookmarks *repository.BookmarkRepository
	comments  *repository.CommentRepository
	posts     *repository.PostRepository
	users     *repository.UserRepository
}

func NewSocialHandler(
	social *service.SocialService,
	follows *repository.FollowRepository,
	likes *repository.LikeRepository,
	bookmarks *repository.BookmarkRepository,
	comments *repository.CommentRepository,
	posts *repository.PostRepository,
	users *repository.UserRepository,
) *SocialHandler {
	return &SocialHandler{
		social:    social,
		follows:   follows,
		likes:     likes,
		bookmarks: bookmarks,
		comments:  comments,
		posts:     posts,
		users:     users,
	}
}

// --- Follow ---

func (h *SocialHandler) Follow(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	username := chi.URLParam(r, "username")

	if err := h.social.Follow(r.Context(), userID, username); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "following"})
}

func (h *SocialHandler) Unfollow(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	username := chi.URLParam(r, "username")

	if err := h.social.Unfollow(r.Context(), userID, username); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unfollowed"})
}

func (h *SocialHandler) GetFollowers(w http.ResponseWriter, r *http.Request) {
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
		perPage = 20
	}

	users, total, err := h.follows.GetFollowers(r.Context(), user.ID, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get followers")
		return
	}

	h.enrichUsersWithFollowState(r, users)

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":        users,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

func (h *SocialHandler) GetFollowing(w http.ResponseWriter, r *http.Request) {
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
		perPage = 20
	}

	users, total, err := h.follows.GetFollowing(r.Context(), user.ID, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get following")
		return
	}

	h.enrichUsersWithFollowState(r, users)

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":        users,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// enrichUsersWithFollowState sets IsFollowing on each user for the current logged-in user.
func (h *SocialHandler) enrichUsersWithFollowState(r *http.Request, users []model.User) {
	meID := middleware.GetUserID(r.Context())
	if meID == "" || len(users) == 0 {
		return
	}
	for i := range users {
		if users[i].ID == meID {
			continue
		}
		following, err := h.follows.IsFollowing(r.Context(), meID, users[i].ID)
		if err == nil {
			users[i].IsFollowing = following
		}
	}
}

func (h *SocialHandler) Feed(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	followingIDs, err := h.follows.GetFollowingIDs(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get feed")
		return
	}

	if len(followingIDs) == 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"data": []interface{}{}, "total": 0, "page": 1, "per_page": 10, "total_pages": 0,
		})
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

	paged, total, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:    "published",
		AuthorIDs: followingIDs,
		Page:      page,
		PerPage:   perPage,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get feed")
		return
	}

	h.enrichPosts(r, paged)

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":        paged,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// --- Like ---

func (h *SocialHandler) LikePost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.social.Like(r.Context(), userID, postID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "liked"})
}

func (h *SocialHandler) UnlikePost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.social.Unlike(r.Context(), userID, postID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unliked"})
}

func (h *SocialHandler) GetLikedPosts(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	posts, total, err := h.likes.GetLikedPosts(r.Context(), userID, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get liked posts")
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

// --- Bookmark ---

func (h *SocialHandler) BookmarkPost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.bookmarks.Add(r.Context(), userID, postID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "bookmarked"})
}

func (h *SocialHandler) UnbookmarkPost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.bookmarks.Remove(r.Context(), userID, postID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unbookmarked"})
}

func (h *SocialHandler) GetBookmarks(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	posts, total, err := h.bookmarks.GetBookmarks(r.Context(), userID, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get bookmarks")
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

// --- Comments ---

func (h *SocialHandler) GetComments(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 20
	}

	comments, total, err := h.comments.GetByPost(r.Context(), postID, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get comments")
		return
	}

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":        comments,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

func (h *SocialHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	postID := chi.URLParam(r, "id")

	var req struct {
		Content  string  `json:"content"`
		ParentID *string `json:"parent_id,omitempty"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}
	if len(req.Content) > 10000 {
		writeError(w, http.StatusBadRequest, "comment too long (max 10000 characters)")
		return
	}

	comment := &model.Comment{
		PostID:   postID,
		AuthorID: userID,
		ParentID: req.ParentID,
		Content:  req.Content,
	}

	if err := h.social.CreateComment(r.Context(), comment); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create comment")
		return
	}

	// Fetch author info for response
	c, _ := h.comments.GetByID(r.Context(), comment.ID)
	if c != nil {
		comment = c
	}

	writeJSON(w, http.StatusCreated, comment)
}

func (h *SocialHandler) UpdateComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	commentID := chi.URLParam(r, "id")

	comment, err := h.comments.GetByID(r.Context(), commentID)
	if err != nil || comment == nil {
		writeError(w, http.StatusNotFound, "comment not found")
		return
	}
	if comment.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not your comment")
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}
	if len(req.Content) > 10000 {
		writeError(w, http.StatusBadRequest, "comment too long (max 10000 characters)")
		return
	}

	if err := h.comments.Update(r.Context(), commentID, req.Content); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update comment")
		return
	}

	comment.Content = req.Content
	writeJSON(w, http.StatusOK, comment)
}

func (h *SocialHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	commentID := chi.URLParam(r, "id")

	comment, err := h.comments.GetByID(r.Context(), commentID)
	if err != nil || comment == nil {
		writeError(w, http.StatusNotFound, "comment not found")
		return
	}
	if comment.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not your comment")
		return
	}

	if err := h.comments.Delete(r.Context(), commentID, comment.PostID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete comment")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Post enrichment helpers ---

func (h *SocialHandler) enrichPosts(r *http.Request, posts []model.Post) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" || len(posts) == 0 {
		return
	}

	postIDs := make([]string, len(posts))
	for i, p := range posts {
		postIDs[i] = p.ID
	}

	likedIDs, _ := h.likes.GetLikedPostIDs(r.Context(), userID, postIDs)
	bookmarkedIDs, _ := h.bookmarks.GetBookmarkedPostIDs(r.Context(), userID, postIDs)

	for i := range posts {
		posts[i].IsLiked = likedIDs[posts[i].ID]
		posts[i].IsBookmarked = bookmarkedIDs[posts[i].ID]
	}
}

// EnrichPostSlice is exported for use by other handlers
func (h *SocialHandler) EnrichPostSlice(r *http.Request, posts []model.Post) {
	h.enrichPosts(r, posts)
}

// EnrichPost enriches a single post
func (h *SocialHandler) EnrichPost(r *http.Request, post *model.Post) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		return
	}
	liked, _ := h.likes.IsLiked(r.Context(), userID, post.ID)
	bookmarked, _ := h.bookmarks.IsBookmarked(r.Context(), userID, post.ID)
	post.IsLiked = liked
	post.IsBookmarked = bookmarked
}
