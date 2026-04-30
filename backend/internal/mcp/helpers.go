package mcp

import (
	"fmt"
	"strings"

	"github.com/nowbind/nowbind/internal/model"
)

func postURL(frontendURL, slug string) string {
	return fmt.Sprintf("%s/post/%s", strings.TrimRight(frontendURL, "/"), slug)
}

func authorURL(frontendURL, username string) string {
	return fmt.Sprintf("%s/author/%s", strings.TrimRight(frontendURL, "/"), username)
}

func tagURL(frontendURL, slug string) string {
	return fmt.Sprintf("%s/tag/%s", strings.TrimRight(frontendURL, "/"), slug)
}

func displayAuthorName(author *model.User) string {
	if author == nil {
		return ""
	}
	if strings.TrimSpace(author.DisplayName) != "" {
		return author.DisplayName
	}
	return author.Username
}

func postSnippet(post model.Post) string {
	if strings.TrimSpace(post.Excerpt) != "" {
		return post.Excerpt
	}
	if strings.TrimSpace(post.Subtitle) != "" {
		return post.Subtitle
	}
	return "No excerpt available."
}

func emptyOrFallback(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func tagNames(tags []model.Tag) []string {
	names := make([]string, 0, len(tags))
	for _, tag := range tags {
		names = append(names, tag.Name)
	}
	return names
}

func summarizePosts(posts []model.Post, frontendURL string) []map[string]interface{} {
	summaries := make([]map[string]interface{}, 0, len(posts))
	for _, post := range posts {
		summaries = append(summaries, map[string]interface{}{
			"title":        post.Title,
			"slug":         post.Slug,
			"url":          postURL(frontendURL, post.Slug),
			"excerpt":      postSnippet(post),
			"reading_time": post.ReadingTime,
			"published_at": post.PublishedAt,
			"author":       displayAuthorName(post.Author),
			"tags":         summarizeTags(post.Tags),
		})
	}
	return summaries
}

func summarizeAuthors(authors []model.User, frontendURL string) []map[string]interface{} {
	summaries := make([]map[string]interface{}, 0, len(authors))
	for _, author := range authors {
		summaries = append(summaries, summarizeAuthor(author, frontendURL))
	}
	return summaries
}

func summarizeAuthor(author model.User, frontendURL string) map[string]interface{} {
	return map[string]interface{}{
		"username":        author.Username,
		"display_name":    displayAuthorName(&author),
		"bio":             author.Bio,
		"avatar_url":      author.AvatarURL,
		"profile_url":     authorURL(frontendURL, author.Username),
		"follower_count":  author.FollowerCount,
		"following_count": author.FollowingCount,
	}
}

func summarizeTags(tags []model.Tag) []map[string]interface{} {
	summaries := make([]map[string]interface{}, 0, len(tags))
	for _, tag := range tags {
		summaries = append(summaries, map[string]interface{}{
			"name":       tag.Name,
			"slug":       tag.Slug,
			"post_count": tag.PostCount,
		})
	}
	return summaries
}
