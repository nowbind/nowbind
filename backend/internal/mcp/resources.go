package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nowbind/nowbind/internal/repository"
)

func (s *MCPServer) handleResourcesList() interface{} {
	return map[string]interface{}{
		"resources": []map[string]interface{}{
			{
				"uri":         "nowbind://posts",
				"name":        "All Posts",
				"description": "List of all published posts on NowBind",
				"mimeType":    "application/json",
			},
			{
				"uri":         "nowbind://posts/{slug}",
				"name":        "Post by Slug",
				"description": "Get a specific post by its slug",
				"mimeType":    "text/markdown",
			},
			{
				"uri":         "nowbind://authors",
				"name":        "Authors",
				"description": "List of NowBind authors",
				"mimeType":    "application/json",
			},
			{
				"uri":         "nowbind://tags",
				"name":        "Tags",
				"description": "List of all tags",
				"mimeType":    "application/json",
			},
			{
				"uri":         "nowbind://feed",
				"name":        "Feed",
				"description": "Recent posts feed",
				"mimeType":    "text/plain",
			},
		},
	}
}

func (s *MCPServer) handleResourcesRead(ctx context.Context, params json.RawMessage) (interface{}, *rpcError) {
	var req struct {
		URI string `json:"uri"`
	}
	if err := json.Unmarshal(params, &req); err != nil {
		return nil, &rpcError{Code: -32602, Message: "Invalid params"}
	}

	switch {
	case req.URI == "nowbind://posts":
		return s.readAllPosts(ctx)
	case strings.HasPrefix(req.URI, "nowbind://posts/"):
		slug := strings.TrimPrefix(req.URI, "nowbind://posts/")
		return s.readPost(ctx, slug)
	case req.URI == "nowbind://tags":
		return s.readTags(ctx)
	case req.URI == "nowbind://feed":
		return s.readFeed(ctx)
	default:
		return nil, &rpcError{Code: -32602, Message: fmt.Sprintf("Unknown resource URI: %s", req.URI)}
	}
}

func (s *MCPServer) readAllPosts(ctx context.Context) (interface{}, *rpcError) {
	posts, _, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 100,
	})
	if err != nil {
		return nil, handleError(err)
	}

	data, _ := json.Marshal(posts)
	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      "nowbind://posts",
				"mimeType": "application/json",
				"text":     string(data),
			},
		},
	}, nil
}

func (s *MCPServer) readPost(ctx context.Context, slug string) (interface{}, *rpcError) {
	post, err := s.posts.GetBySlug(ctx, slug)
	if err != nil {
		return nil, handleError(err)
	}
	if post == nil {
		return nil, &rpcError{Code: -32602, Message: "Post not found"}
	}

	// Return as structured markdown
	var b strings.Builder
	b.WriteString(fmt.Sprintf("# %s\n\n", post.Title))
	if post.Subtitle != "" {
		b.WriteString(fmt.Sprintf("*%s*\n\n", post.Subtitle))
	}
	if post.Author != nil {
		b.WriteString(fmt.Sprintf("By %s | %d min read\n\n", post.Author.DisplayName, post.ReadingTime))
	}
	b.WriteString("---\n\n")
	b.WriteString(post.Content)

	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      fmt.Sprintf("nowbind://posts/%s", slug),
				"mimeType": "text/markdown",
				"text":     b.String(),
			},
		},
	}, nil
}

func (s *MCPServer) readTags(ctx context.Context) (interface{}, *rpcError) {
	tags, err := s.tags.List(ctx)
	if err != nil {
		return nil, handleError(err)
	}

	data, _ := json.Marshal(tags)
	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      "nowbind://tags",
				"mimeType": "application/json",
				"text":     string(data),
			},
		},
	}, nil
}

func (s *MCPServer) readFeed(ctx context.Context) (interface{}, *rpcError) {
	posts, _, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 20,
	})
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString("# NowBind Feed\n\n")
	for _, p := range posts {
		b.WriteString(fmt.Sprintf("## %s\n", p.Title))
		b.WriteString(fmt.Sprintf("%s\n", p.Excerpt))
		b.WriteString(fmt.Sprintf("URL: %s/post/%s\n\n", s.frontendURL, p.Slug))
	}

	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      "nowbind://feed",
				"mimeType": "text/plain",
				"text":     b.String(),
			},
		},
	}, nil
}
