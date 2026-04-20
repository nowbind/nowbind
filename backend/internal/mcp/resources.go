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
				"description": "List of published posts on NowBind",
				"mimeType":    "application/json",
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
				"description": "List of NowBind tags",
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

func (s *MCPServer) handleResourceTemplatesList() interface{} {
	return map[string]interface{}{
		"resourceTemplates": []map[string]interface{}{
			{
				"uriTemplate": "nowbind://posts/{slug}",
				"name":        "Post by Slug",
				"description": "Read a published post by slug",
				"mimeType":    "text/markdown",
			},
			{
				"uriTemplate": "nowbind://authors/{username}",
				"name":        "Author by Username",
				"description": "Read an author profile with recent posts and top tags",
				"mimeType":    "application/json",
			},
			{
				"uriTemplate": "nowbind://tags/{slug}",
				"name":        "Tag by Slug",
				"description": "Read a tag overview with recent posts",
				"mimeType":    "application/json",
			},
		},
	}
}

func (s *MCPServer) handleResourcesRead(ctx context.Context, params json.RawMessage) (interface{}, *rpcError) {
	var req struct {
		URI string `json:"uri"`
	}
	if err := json.Unmarshal(params, &req); err != nil || req.URI == "" {
		return nil, &rpcError{Code: -32602, Message: "Invalid params"}
	}

	switch {
	case req.URI == "nowbind://posts":
		return s.readAllPosts(ctx)
	case strings.HasPrefix(req.URI, "nowbind://posts/"):
		return s.readPost(ctx, strings.TrimPrefix(req.URI, "nowbind://posts/"))
	case req.URI == "nowbind://authors":
		return s.readAuthors(ctx)
	case strings.HasPrefix(req.URI, "nowbind://authors/"):
		return s.readAuthor(ctx, strings.TrimPrefix(req.URI, "nowbind://authors/"))
	case req.URI == "nowbind://tags":
		return s.readTags(ctx)
	case strings.HasPrefix(req.URI, "nowbind://tags/"):
		return s.readTag(ctx, strings.TrimPrefix(req.URI, "nowbind://tags/"))
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

	data, _ := json.Marshal(summarizePosts(posts, s.frontendURL))
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
	if post == nil || post.Status != "published" {
		return nil, &rpcError{Code: -32602, Message: "Post not found"}
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("# %s\n\n", post.Title))
	if post.Subtitle != "" {
		b.WriteString(fmt.Sprintf("*%s*\n\n", post.Subtitle))
	}
	if post.Author != nil {
		b.WriteString(fmt.Sprintf("By %s | %d min read\n\n", displayAuthorName(post.Author), post.ReadingTime))
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

func (s *MCPServer) readAuthors(ctx context.Context) (interface{}, *rpcError) {
	authors, err := s.users.ListAuthors(ctx)
	if err != nil {
		return nil, handleError(err)
	}

	data, _ := json.Marshal(summarizeAuthors(authors, s.frontendURL))
	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      "nowbind://authors",
				"mimeType": "application/json",
				"text":     string(data),
			},
		},
	}, nil
}

func (s *MCPServer) readAuthor(ctx context.Context, username string) (interface{}, *rpcError) {
	user, err := s.users.GetByUsername(ctx, username)
	if err != nil {
		return nil, handleError(err)
	}
	if user == nil {
		return nil, &rpcError{Code: -32602, Message: "Author not found"}
	}

	posts, total, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:   "published",
		AuthorID: user.ID,
		Page:     1,
		PerPage:  10,
	})
	if err != nil {
		return nil, handleError(err)
	}

	tags, err := s.posts.ListTagsByAuthor(ctx, user.ID)
	if err != nil {
		return nil, handleError(err)
	}

	payload := map[string]interface{}{
		"author":               summarizeAuthor(*user, s.frontendURL),
		"published_post_count": total,
		"top_tags":             tags,
		"recent_posts":         summarizePosts(posts, s.frontendURL),
	}

	data, _ := json.Marshal(payload)
	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      fmt.Sprintf("nowbind://authors/%s", username),
				"mimeType": "application/json",
				"text":     string(data),
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

func (s *MCPServer) readTag(ctx context.Context, slug string) (interface{}, *rpcError) {
	tag, err := s.tags.GetBySlug(ctx, slug)
	if err != nil {
		return nil, handleError(err)
	}
	if tag == nil {
		return nil, &rpcError{Code: -32602, Message: "Tag not found"}
	}

	posts, total, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:  "published",
		TagSlug: slug,
		Page:    1,
		PerPage: 20,
	})
	if err != nil {
		return nil, handleError(err)
	}

	payload := map[string]interface{}{
		"tag":             tag,
		"tag_page_url":    tagURL(s.frontendURL, slug),
		"published_posts": total,
		"recent_posts":    summarizePosts(posts, s.frontendURL),
	}

	data, _ := json.Marshal(payload)
	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      fmt.Sprintf("nowbind://tags/%s", slug),
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
	for _, post := range posts {
		b.WriteString(fmt.Sprintf("## %s\n", post.Title))
		b.WriteString(fmt.Sprintf("%s\n", postSnippet(post)))
		b.WriteString(fmt.Sprintf("URL: %s\n\n", postURL(s.frontendURL, post.Slug)))
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
