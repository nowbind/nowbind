package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/nowbind/nowbind/internal/repository"
)

type LLMSHandler struct {
	posts       *repository.PostRepository
	frontendURL string
}

func NewLLMSHandler(posts *repository.PostRepository, frontendURL string) *LLMSHandler {
	return &LLMSHandler{posts: posts, frontendURL: frontendURL}
}

// LLMSTxt generates the llms.txt index following https://llmstxt.org spec
func (h *LLMSHandler) LLMSTxt(w http.ResponseWriter, r *http.Request) {
	posts, _, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 100,
	})
	if err != nil {
		http.Error(w, "failed to get posts", http.StatusInternalServerError)
		return
	}

	var b strings.Builder
	b.WriteString("# NowBind\n\n")
	b.WriteString("> The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.\n\n")
	b.WriteString(fmt.Sprintf("- [NowBind Home](%s)\n", h.frontendURL))
	b.WriteString(fmt.Sprintf("- [Full Content](%s/llms-full.txt)\n", h.frontendURL))
	b.WriteString(fmt.Sprintf("- [Agent API](%s/api/v1/agent/posts)\n", h.frontendURL))
	b.WriteString(fmt.Sprintf("- [MCP Server](%s/mcp)\n\n", h.frontendURL))
	b.WriteString("## Posts\n\n")

	for _, p := range posts {
		authorName := ""
		if p.Author != nil {
			authorName = p.Author.DisplayName
			if authorName == "" {
				authorName = p.Author.Username
			}
		}
		b.WriteString(fmt.Sprintf("- [%s](%s/post/%s): %s (by %s)\n",
			p.Title, h.frontendURL, p.Slug, p.Excerpt, authorName))
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(b.String()))
}

// LLMSFullTxt generates llms-full.txt with all content concatenated
func (h *LLMSHandler) LLMSFullTxt(w http.ResponseWriter, r *http.Request) {
	posts, _, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 1000,
	})
	if err != nil {
		http.Error(w, "failed to get posts", http.StatusInternalServerError)
		return
	}

	var b strings.Builder
	b.WriteString("# NowBind - Full Content\n\n")

	for _, p := range posts {
		b.WriteString(fmt.Sprintf("## %s\n\n", p.Title))
		if p.Subtitle != "" {
			b.WriteString(fmt.Sprintf("*%s*\n\n", p.Subtitle))
		}
		authorName := ""
		if p.Author != nil {
			authorName = p.Author.DisplayName
			if authorName == "" {
				authorName = p.Author.Username
			}
		}
		b.WriteString(fmt.Sprintf("By %s | %d min read\n\n", authorName, p.ReadingTime))
		if p.StructuredMD != "" {
			b.WriteString(p.StructuredMD)
		} else {
			// Include content in the full txt even if structured_md is empty
			b.WriteString(p.Excerpt)
		}
		b.WriteString("\n\n---\n\n")
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(b.String()))
}
