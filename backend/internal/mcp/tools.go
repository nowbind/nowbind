package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nowbind/nowbind/internal/repository"
)

func (s *MCPServer) handleToolsList() interface{} {
	return map[string]interface{}{
		"tools": []map[string]interface{}{
			{
				"name":        "search_posts",
				"description": "Search NowBind posts by keyword. Returns matching posts with title, excerpt, and URL.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"query": map[string]string{
							"type":        "string",
							"description": "Search query string",
						},
					},
					"required": []string{"query"},
				},
			},
			{
				"name":        "get_post",
				"description": "Get the full content of a NowBind post by its slug. Returns the complete markdown content.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"slug": map[string]string{
							"type":        "string",
							"description": "The post slug (URL identifier)",
						},
					},
					"required": []string{"slug"},
				},
			},
			{
				"name":        "list_posts",
				"description": "List recent published posts on NowBind. Optionally filter by tag.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"tag": map[string]string{
							"type":        "string",
							"description": "Filter by tag slug (optional)",
						},
						"limit": map[string]interface{}{
							"type":        "number",
							"description": "Max number of posts to return (default 10, max 50)",
						},
					},
				},
			},
			{
				"name":        "get_author",
				"description": "Get information about a NowBind author by username.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"username": map[string]string{
							"type":        "string",
							"description": "The author's username",
						},
					},
					"required": []string{"username"},
				},
			},
		},
	}
}

func (s *MCPServer) handleToolsCall(ctx context.Context, params json.RawMessage) (interface{}, *rpcError) {
	var req struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &req); err != nil {
		return nil, &rpcError{Code: -32602, Message: "Invalid params"}
	}

	switch req.Name {
	case "search_posts":
		return s.toolSearchPosts(ctx, req.Arguments)
	case "get_post":
		return s.toolGetPost(ctx, req.Arguments)
	case "list_posts":
		return s.toolListPosts(ctx, req.Arguments)
	case "get_author":
		return s.toolGetAuthor(ctx, req.Arguments)
	default:
		return nil, &rpcError{Code: -32602, Message: fmt.Sprintf("Unknown tool: %s", req.Name)}
	}
}

func (s *MCPServer) toolSearchPosts(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal(args, &params); err != nil || params.Query == "" {
		return nil, &rpcError{Code: -32602, Message: "query parameter required"}
	}

	posts, total, err := s.posts.Search(ctx, params.Query, 1, 10)
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Found %d results for \"%s\":\n\n", total, params.Query))
	for _, p := range posts {
		b.WriteString(fmt.Sprintf("- **%s** (%s/post/%s)\n  %s\n\n", p.Title, s.frontendURL, p.Slug, p.Excerpt))
	}

	return toolResult(b.String()), nil
}

func (s *MCPServer) toolGetPost(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Slug string `json:"slug"`
	}
	if err := json.Unmarshal(args, &params); err != nil || params.Slug == "" {
		return nil, &rpcError{Code: -32602, Message: "slug parameter required"}
	}

	post, err := s.posts.GetBySlug(ctx, params.Slug)
	if err != nil {
		return nil, handleError(err)
	}
	if post == nil || post.Status != "published" {
		return nil, &rpcError{Code: -32602, Message: "Post not found"}
	}

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
	b.WriteString(fmt.Sprintf("Author: %s | Reading Time: %d min\n", authorName, post.ReadingTime))
	if len(post.AIKeywords) > 0 {
		b.WriteString(fmt.Sprintf("Keywords: %s\n", strings.Join(post.AIKeywords, ", ")))
	}
	b.WriteString("\n---\n\n")
	b.WriteString(post.Content)

	return toolResult(b.String()), nil
}

func (s *MCPServer) toolListPosts(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Tag   string `json:"tag"`
		Limit int    `json:"limit"`
	}
	json.Unmarshal(args, &params)

	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 10
	}

	posts, total, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:  "published",
		TagSlug: params.Tag,
		Page:    1,
		PerPage: params.Limit,
	})
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Showing %d of %d posts", len(posts), total))
	if params.Tag != "" {
		b.WriteString(fmt.Sprintf(" tagged \"%s\"", params.Tag))
	}
	b.WriteString(":\n\n")

	for _, p := range posts {
		authorName := ""
		if p.Author != nil {
			authorName = p.Author.DisplayName
			if authorName == "" {
				authorName = p.Author.Username
			}
		}
		b.WriteString(fmt.Sprintf("- **%s** by %s (%d min read)\n  %s\n  URL: %s/post/%s\n\n",
			p.Title, authorName, p.ReadingTime, p.Excerpt, s.frontendURL, p.Slug))
	}

	return toolResult(b.String()), nil
}

func (s *MCPServer) toolGetAuthor(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Username string `json:"username"`
	}
	if err := json.Unmarshal(args, &params); err != nil || params.Username == "" {
		return nil, &rpcError{Code: -32602, Message: "username parameter required"}
	}

	user, err := s.users.GetByUsername(ctx, params.Username)
	if err != nil {
		return nil, handleError(err)
	}
	if user == nil {
		return nil, &rpcError{Code: -32602, Message: "Author not found"}
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("# %s\n\n", user.DisplayName))
	b.WriteString(fmt.Sprintf("Username: @%s\n", user.Username))
	if user.Bio != "" {
		b.WriteString(fmt.Sprintf("Bio: %s\n", user.Bio))
	}
	b.WriteString(fmt.Sprintf("Profile: %s/author/%s\n", s.frontendURL, user.Username))

	return toolResult(b.String()), nil
}

func toolResult(text string) interface{} {
	return map[string]interface{}{
		"content": []map[string]interface{}{
			{
				"type": "text",
				"text": text,
			},
		},
	}
}
