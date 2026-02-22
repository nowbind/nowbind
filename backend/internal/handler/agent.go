package handler

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/repository"
)

type AgentHandler struct {
	posts       *repository.PostRepository
	tags        *repository.TagRepository
	users       *repository.UserRepository
	analytics   *repository.AnalyticsRepository
	frontendURL string
}

func NewAgentHandler(posts *repository.PostRepository, tags *repository.TagRepository, users *repository.UserRepository, analytics *repository.AnalyticsRepository, frontendURL string) *AgentHandler {
	return &AgentHandler{posts: posts, tags: tags, users: users, analytics: analytics, frontendURL: frontendURL}
}

func (h *AgentHandler) ListPosts(w http.ResponseWriter, r *http.Request) {
	posts, _, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 100,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list posts")
		return
	}

	type AgentPost struct {
		Slug        string   `json:"slug"`
		Title       string   `json:"title"`
		Subtitle    string   `json:"subtitle,omitempty"`
		Author      string   `json:"author"`
		Excerpt     string   `json:"excerpt"`
		ReadingTime int      `json:"reading_time"`
		PublishedAt string   `json:"published_at,omitempty"`
		Tags        []string `json:"tags"`
		Keywords    []string `json:"keywords"`
		URL         string   `json:"url"`
		ContentURL  string   `json:"content_url"`
	}

	var result []AgentPost
	for _, p := range posts {
		ap := AgentPost{
			Slug:        p.Slug,
			Title:       p.Title,
			Subtitle:    p.Subtitle,
			Excerpt:     p.Excerpt,
			ReadingTime: p.ReadingTime,
			Keywords:    p.AIKeywords,
			URL:         fmt.Sprintf("%s/post/%s", h.frontendURL, p.Slug),
			ContentURL:  fmt.Sprintf("%s/api/v1/agent/posts/%s", h.frontendURL, p.Slug),
		}
		if p.PublishedAt != nil {
			ap.PublishedAt = p.PublishedAt.Format("2006-01-02T15:04:05Z")
		}
		if p.Author != nil {
			ap.Author = p.Author.DisplayName
			if ap.Author == "" {
				ap.Author = p.Author.Username
			}
		}
		for _, t := range p.Tags {
			ap.Tags = append(ap.Tags, t.Name)
		}
		result = append(result, ap)
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *AgentHandler) GetPost(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	post, err := h.posts.GetBySlug(r.Context(), slug)
	if err != nil || post == nil || post.Status != "published" {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}

	// Track as AI view
	go func() {
		ip := r.RemoteAddr
		if fwd := r.Header.Get("X-Real-Ip"); fwd != "" {
			ip = fwd
		}
		if host, _, err := net.SplitHostPort(ip); err == nil {
			ip = host
		}
		if err := h.analytics.RecordView(context.Background(), post.ID, ip, "", "agent", r.Header.Get("User-Agent")); err != nil {
			log.Printf("agent: RecordView error: %v", err)
		}
	}()

	// Return structured markdown with metadata
	var b strings.Builder
	b.WriteString(fmt.Sprintf("# %s\n\n", post.Title))
	if post.Subtitle != "" {
		b.WriteString(fmt.Sprintf("*%s*\n\n", post.Subtitle))
	}
	authorName := ""
	if post.Author != nil {
		authorName = post.Author.DisplayName
		if authorName == "" {
			authorName = post.Author.Username
		}
	}
	b.WriteString(fmt.Sprintf("**Author:** %s\n", authorName))
	b.WriteString(fmt.Sprintf("**Reading Time:** %d min\n", post.ReadingTime))
	if len(post.AIKeywords) > 0 {
		b.WriteString(fmt.Sprintf("**Keywords:** %s\n", strings.Join(post.AIKeywords, ", ")))
	}
	b.WriteString("\n---\n\n")
	b.WriteString(post.Content)

	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Write([]byte(b.String()))
}

func (h *AgentHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeError(w, http.StatusBadRequest, "query parameter 'q' is required")
		return
	}

	posts, total, err := h.posts.Search(r.Context(), query, 1, 20)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "search failed")
		return
	}

	type AgentSearchResult struct {
		Slug    string `json:"slug"`
		Title   string `json:"title"`
		Excerpt string `json:"excerpt"`
		URL     string `json:"url"`
	}

	var results []AgentSearchResult
	for _, p := range posts {
		results = append(results, AgentSearchResult{
			Slug:    p.Slug,
			Title:   p.Title,
			Excerpt: p.Excerpt,
			URL:     fmt.Sprintf("%s/post/%s", h.frontendURL, p.Slug),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query":   query,
		"total":   total,
		"results": results,
	})
}

func (h *AgentHandler) ListAuthors(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	authors, total, err := h.users.ListAuthorsPaginated(r.Context(), page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list authors")
		return
	}

	type AgentAuthor struct {
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		Bio         string `json:"bio,omitempty"`
		URL         string `json:"url"`
		PostCount   int    `json:"post_count,omitempty"`
	}

	var result []AgentAuthor
	for _, a := range authors {
		name := a.DisplayName
		if name == "" {
			name = a.Username
		}
		result = append(result, AgentAuthor{
			Username:    a.Username,
			DisplayName: name,
			Bio:         a.Bio,
			URL:         fmt.Sprintf("%s/author/%s", h.frontendURL, a.Username),
		})
	}

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	w.Header().Set("X-Page", strconv.Itoa(page))
	w.Header().Set("X-Per-Page", strconv.Itoa(perPage))
	w.Header().Set("X-Total-Pages", strconv.Itoa(totalPages))
	writeJSON(w, http.StatusOK, result)
}

func (h *AgentHandler) ListTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.tags.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tags")
		return
	}
	writeJSON(w, http.StatusOK, tags)
}
