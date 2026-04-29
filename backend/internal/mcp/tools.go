package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default 1)",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
							"description": "Max results per page (default 10, max 50)",
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
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default 1)",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
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
			{
				"name":        "search_authors",
				"description": "Search NowBind authors by username or display name.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"query": map[string]string{
							"type":        "string",
							"description": "Author search query",
						},
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default 1)",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
							"description": "Max number of authors to return (default 10, max 50)",
						},
					},
					"required": []string{"query"},
				},
			},
			{
				"name":        "list_author_posts",
				"description": "List published posts from a specific NowBind author.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"username": map[string]string{
							"type":        "string",
							"description": "The author's username",
						},
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default 1)",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
							"description": "Max number of posts to return (default 10, max 50)",
						},
					},
					"required": []string{"username"},
				},
			},
			{
				"name":        "list_tags",
				"description": "List NowBind tags ordered by published post count.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default 1)",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
							"description": "Max number of tags to return (default 20, max 50)",
						},
					},
				},
			},
			{
				"name":        "get_tag_posts",
				"description": "List published posts for a specific NowBind tag slug.",
				"inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"slug": map[string]string{
							"type":        "string",
							"description": "Tag slug",
						},
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default 1)",
						},
						"limit": map[string]interface{}{
							"type":        "integer",
							"description": "Max number of posts to return (default 10, max 50)",
						},
					},
					"required": []string{"slug"},
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
	case "search_authors":
		return s.toolSearchAuthors(ctx, req.Arguments)
	case "list_author_posts":
		return s.toolListAuthorPosts(ctx, req.Arguments)
	case "list_tags":
		return s.toolListTags(ctx, req.Arguments)
	case "get_tag_posts":
		return s.toolGetTagPosts(ctx, req.Arguments)
	default:
		return nil, &rpcError{Code: -32602, Message: fmt.Sprintf("Unknown tool: %s", req.Name)}
	}
}

func (s *MCPServer) toolSearchPosts(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Query string `json:"query"`
		Page  int    `json:"page"`
		Limit int    `json:"limit"`
	}
	if err := json.Unmarshal(args, &params); err != nil || params.Query == "" {
		return nil, &rpcError{Code: -32602, Message: "query parameter required"}
	}
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 10
	}

	posts, total, err := s.posts.Search(ctx, params.Query, params.Page, params.Limit)
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Found %d results for %q (page %d):\n\n", total, params.Query, params.Page))
	for _, post := range posts {
		b.WriteString(fmt.Sprintf("- **%s** (%s)\n  %s\n\n", post.Title, postURL(s.frontendURL, post.Slug), postSnippet(post)))
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

	if s.analytics != nil {
		go func() {
			if err := s.analytics.RecordView(context.Background(), post.ID, "", "", "mcp", "mcp-client"); err != nil {
				log.Printf("mcp: RecordView error: %v", err)
			}
		}()
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("# %s\n\n", post.Title))
	if post.Subtitle != "" {
		b.WriteString(fmt.Sprintf("*%s*\n\n", post.Subtitle))
	}
	b.WriteString(fmt.Sprintf("Author: %s | Reading Time: %d min\n", displayAuthorName(post.Author), post.ReadingTime))
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
		Page  int    `json:"page"`
		Limit int    `json:"limit"`
	}
	json.Unmarshal(args, &params)

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 10
	}

	posts, total, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:  "published",
		TagSlug: params.Tag,
		Page:    params.Page,
		PerPage: params.Limit,
	})
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Showing %d of %d posts on page %d", len(posts), total, params.Page))
	if params.Tag != "" {
		b.WriteString(fmt.Sprintf(" tagged %q", params.Tag))
	}
	b.WriteString(":\n\n")

	for _, post := range posts {
		b.WriteString(fmt.Sprintf("- **%s** by %s (%d min read)\n  %s\n  URL: %s\n\n",
			post.Title, displayAuthorName(post.Author), post.ReadingTime, postSnippet(post), postURL(s.frontendURL, post.Slug)))
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

	posts, total, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:   "published",
		AuthorID: user.ID,
		Page:     1,
		PerPage:  5,
	})
	if err != nil {
		return nil, handleError(err)
	}

	tags, err := s.posts.ListTagsByAuthor(ctx, user.ID)
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("# %s\n\n", displayAuthorName(user)))
	b.WriteString(fmt.Sprintf("Username: @%s\n", user.Username))
	if user.Bio != "" {
		b.WriteString(fmt.Sprintf("Bio: %s\n", user.Bio))
	}
	b.WriteString(fmt.Sprintf("Profile: %s\n", authorURL(s.frontendURL, user.Username)))
	b.WriteString(fmt.Sprintf("Published posts: %d\n", total))
	if len(tags) > 0 {
		b.WriteString(fmt.Sprintf("Top tags: %s\n", strings.Join(tagNames(tags), ", ")))
	}
	if len(posts) > 0 {
		b.WriteString("\nRecent posts:\n")
		for _, post := range posts {
			b.WriteString(fmt.Sprintf("- %s (%s)\n", post.Title, postURL(s.frontendURL, post.Slug)))
		}
	}

	return toolResult(b.String()), nil
}

func (s *MCPServer) toolSearchAuthors(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Query string `json:"query"`
		Page  int    `json:"page"`
		Limit int    `json:"limit"`
	}
	if err := json.Unmarshal(args, &params); err != nil || params.Query == "" {
		return nil, &rpcError{Code: -32602, Message: "query parameter required"}
	}
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 10
	}

	authors, total, err := s.users.SearchAuthors(ctx, params.Query, params.Page, params.Limit)
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Found %d authors for %q (page %d):\n\n", total, params.Query, params.Page))
	for _, author := range authors {
		b.WriteString(fmt.Sprintf("- **%s** (@%s)\n  %s\n  Profile: %s\n\n",
			displayAuthorName(&author), author.Username, emptyOrFallback(author.Bio, "No bio provided."), authorURL(s.frontendURL, author.Username)))
	}

	return toolResult(b.String()), nil
}

func (s *MCPServer) toolListAuthorPosts(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Username string `json:"username"`
		Page     int    `json:"page"`
		Limit    int    `json:"limit"`
	}
	if err := json.Unmarshal(args, &params); err != nil || params.Username == "" {
		return nil, &rpcError{Code: -32602, Message: "username parameter required"}
	}
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 10
	}

	user, err := s.users.GetByUsername(ctx, params.Username)
	if err != nil {
		return nil, handleError(err)
	}
	if user == nil {
		return nil, &rpcError{Code: -32602, Message: "Author not found"}
	}

	posts, total, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:   "published",
		AuthorID: user.ID,
		Page:     params.Page,
		PerPage:  params.Limit,
	})
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Showing %d of %d posts by %s (page %d):\n\n", len(posts), total, displayAuthorName(user), params.Page))
	for _, post := range posts {
		b.WriteString(fmt.Sprintf("- **%s** (%s)\n  %s\n\n", post.Title, postURL(s.frontendURL, post.Slug), postSnippet(post)))
	}

	return toolResult(b.String()), nil
}

func (s *MCPServer) toolListTags(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Page  int `json:"page"`
		Limit int `json:"limit"`
	}
	json.Unmarshal(args, &params)

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 20
	}

	tags, total, err := s.tags.ListPaginated(ctx, params.Page, params.Limit)
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Showing %d of %d tags on page %d:\n\n", len(tags), total, params.Page))
	for _, tag := range tags {
		b.WriteString(fmt.Sprintf("- **%s** (`%s`) - %d posts\n  URL: %s\n\n", tag.Name, tag.Slug, tag.PostCount, tagURL(s.frontendURL, tag.Slug)))
	}

	return toolResult(b.String()), nil
}

func (s *MCPServer) toolGetTagPosts(ctx context.Context, args json.RawMessage) (interface{}, *rpcError) {
	var params struct {
		Slug  string `json:"slug"`
		Page  int    `json:"page"`
		Limit int    `json:"limit"`
	}
	if err := json.Unmarshal(args, &params); err != nil || params.Slug == "" {
		return nil, &rpcError{Code: -32602, Message: "slug parameter required"}
	}
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 10
	}

	tag, err := s.tags.GetBySlug(ctx, params.Slug)
	if err != nil {
		return nil, handleError(err)
	}
	if tag == nil {
		return nil, &rpcError{Code: -32602, Message: "Tag not found"}
	}

	posts, total, err := s.posts.List(ctx, repository.ListPostsParams{
		Status:  "published",
		TagSlug: params.Slug,
		Page:    params.Page,
		PerPage: params.Limit,
	})
	if err != nil {
		return nil, handleError(err)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Showing %d of %d posts tagged %q (page %d):\n\n", len(posts), total, tag.Name, params.Page))
	for _, post := range posts {
		b.WriteString(fmt.Sprintf("- **%s** by %s (%s)\n  %s\n\n",
			post.Title, displayAuthorName(post.Author), postURL(s.frontendURL, post.Slug), postSnippet(post)))
	}

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
