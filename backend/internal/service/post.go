package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/pkg"
)

type PostService struct {
	posts *repository.PostRepository
	tags  *repository.TagRepository
}

func NewPostService(posts *repository.PostRepository, tags *repository.TagRepository) *PostService {
	return &PostService{posts: posts, tags: tags}
}

type CreatePostInput struct {
	Title        string   `json:"title"`
	Subtitle     string   `json:"subtitle"`
	Content      string   `json:"content"`
	ContentJSON  string   `json:"content_json"`
	Excerpt      string   `json:"excerpt"`
	Tags         []string `json:"tags"`
	FeatureImage string   `json:"feature_image"`
	Featured     bool     `json:"featured"`
	Slug         string   `json:"slug"`
}

type UpdatePostInput struct {
	Title        string   `json:"title"`
	Subtitle     string   `json:"subtitle"`
	Content      string   `json:"content"`
	ContentJSON  string   `json:"content_json"`
	Excerpt      string   `json:"excerpt"`
	Tags         []string `json:"tags"`
	FeatureImage *string  `json:"feature_image"`
	Featured     *bool    `json:"featured"`
	Slug         string   `json:"slug"`
}

func (s *PostService) Create(ctx context.Context, authorID string, input CreatePostInput) (*model.Post, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, fmt.Errorf("title is required")
	}

	contentText := input.Content
	var contentJSON *string
	contentFormat := "markdown"

	if input.ContentJSON != "" {
		contentJSON = &input.ContentJSON
		contentFormat = "tiptap"
		contentText = extractTextFromTipTap(input.ContentJSON)
	}

	slug := pkg.UniqueSlug(input.Title)
	if input.Slug != "" {
		slug = pkg.Slugify(input.Slug)
	}

	post := &model.Post{
		AuthorID:      authorID,
		Slug:          slug,
		Title:         input.Title,
		Subtitle:      input.Subtitle,
		Content:       contentText,
		ContentJSON:   contentJSON,
		ContentFormat: contentFormat,
		Excerpt:       input.Excerpt,
		FeatureImage:  input.FeatureImage,
		Featured:      input.Featured,
		Status:        "draft",
		ReadingTime:   pkg.EstimateReadingTime(contentText),
	}

	// Generate AI metadata
	post.AISummary = generateSummary(contentText, input.Excerpt)
	post.AIKeywords = extractKeywords(input.Title, contentText)
	post.StructuredMD = generateStructuredMD(post)

	if err := s.posts.Create(ctx, post); err != nil {
		return nil, fmt.Errorf("creating post: %w", err)
	}

	// Handle tags
	if len(input.Tags) > 0 {
		tagIDs, err := s.ensureTags(ctx, input.Tags)
		if err != nil {
			return nil, err
		}
		if err := s.posts.SetTags(ctx, post.ID, tagIDs); err != nil {
			return nil, err
		}
	}

	return s.posts.GetBySlug(ctx, post.Slug)
}

func (s *PostService) Update(ctx context.Context, postID, authorID string, input UpdatePostInput) (*model.Post, error) {
	post, err := s.posts.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post == nil {
		return nil, fmt.Errorf("post not found")
	}
	if post.AuthorID != authorID {
		return nil, fmt.Errorf("unauthorized")
	}

	if input.Title != "" {
		post.Title = input.Title
		// Only regenerate slug from title if no custom slug provided
		if input.Slug == "" {
			post.Slug = pkg.UniqueSlug(input.Title)
		}
	}
	if input.Slug != "" {
		newSlug := pkg.Slugify(input.Slug)
		if newSlug != post.Slug {
			taken, err := s.posts.IsSlugTaken(ctx, newSlug, post.ID)
			if err != nil {
				return nil, fmt.Errorf("checking slug: %w", err)
			}
			if taken {
				return nil, fmt.Errorf("slug already taken")
			}
			post.Slug = newSlug
		}
	}
	if input.Subtitle != "" {
		post.Subtitle = input.Subtitle
	}
	if input.Excerpt != "" {
		post.Excerpt = input.Excerpt
	}
	if input.FeatureImage != nil {
		post.FeatureImage = *input.FeatureImage
	}
	if input.Featured != nil {
		post.Featured = *input.Featured
	}

	contentText := input.Content
	if input.ContentJSON != "" {
		post.ContentJSON = &input.ContentJSON
		post.ContentFormat = "tiptap"
		contentText = extractTextFromTipTap(input.ContentJSON)
	}
	post.Content = contentText
	post.ReadingTime = pkg.EstimateReadingTime(contentText)

	// Regenerate AI metadata
	post.AISummary = generateSummary(contentText, input.Excerpt)
	post.AIKeywords = extractKeywords(post.Title, contentText)
	post.StructuredMD = generateStructuredMD(post)

	if err := s.posts.Update(ctx, post); err != nil {
		return nil, err
	}

	if input.Tags != nil {
		tagIDs, err := s.ensureTags(ctx, input.Tags)
		if err != nil {
			return nil, err
		}
		if err := s.posts.SetTags(ctx, post.ID, tagIDs); err != nil {
			return nil, err
		}
		s.tags.UpdatePostCounts(ctx)
	}

	return s.posts.GetBySlug(ctx, post.Slug)
}

func (s *PostService) Publish(ctx context.Context, postID, authorID string) error {
	post, err := s.posts.GetByID(ctx, postID)
	if err != nil {
		return err
	}
	if post == nil {
		return fmt.Errorf("post not found")
	}
	if post.AuthorID != authorID {
		return fmt.Errorf("unauthorized")
	}
	if err := s.posts.Publish(ctx, postID); err != nil {
		return err
	}
	s.tags.UpdatePostCounts(ctx)
	return nil
}

func (s *PostService) Unpublish(ctx context.Context, postID, authorID string) error {
	post, err := s.posts.GetByID(ctx, postID)
	if err != nil {
		return err
	}
	if post == nil {
		return fmt.Errorf("post not found")
	}
	if post.AuthorID != authorID {
		return fmt.Errorf("unauthorized")
	}
	if err := s.posts.Unpublish(ctx, postID); err != nil {
		return err
	}
	s.tags.UpdatePostCounts(ctx)
	return nil
}

func (s *PostService) Delete(ctx context.Context, postID, authorID string) error {
	post, err := s.posts.GetByID(ctx, postID)
	if err != nil {
		return err
	}
	if post == nil {
		return fmt.Errorf("post not found")
	}
	if post.AuthorID != authorID {
		return fmt.Errorf("unauthorized")
	}
	if err := s.posts.Delete(ctx, postID); err != nil {
		return err
	}
	s.tags.UpdatePostCounts(ctx)
	return nil
}

func (s *PostService) ensureTags(ctx context.Context, names []string) ([]string, error) {
	var ids []string
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		tag, err := s.tags.FindOrCreate(ctx, name)
		if err != nil {
			return nil, err
		}
		ids = append(ids, tag.ID)
	}
	return ids, nil
}

// Simple AI metadata generation (can be enhanced with actual AI later)
func generateSummary(content, excerpt string) string {
	if excerpt != "" {
		return excerpt
	}
	if len(content) > 300 {
		return content[:300] + "..."
	}
	return content
}

func extractKeywords(title, content string) []string {
	words := strings.Fields(strings.ToLower(title))
	var keywords []string
	seen := make(map[string]bool)
	for _, w := range words {
		w = strings.Trim(w, ".,!?;:\"'()[]{}–—")
		if len(w) > 3 && !seen[w] {
			keywords = append(keywords, w)
			seen[w] = true
		}
	}
	if len(keywords) > 10 {
		keywords = keywords[:10]
	}
	return keywords
}

// extractTextFromTipTap walks a TipTap JSON document tree and collects all text content.
func extractTextFromTipTap(jsonContent string) string {
	var doc map[string]interface{}
	if err := json.Unmarshal([]byte(jsonContent), &doc); err != nil {
		return ""
	}
	var b strings.Builder
	walkTipTapNode(doc, &b)
	return strings.TrimSpace(b.String())
}

func walkTipTapNode(node map[string]interface{}, b *strings.Builder) {
	// If this node has text, write it
	if text, ok := node["text"].(string); ok {
		b.WriteString(text)
	}

	// Recurse into content array
	if content, ok := node["content"].([]interface{}); ok {
		for _, child := range content {
			if childNode, ok := child.(map[string]interface{}); ok {
				walkTipTapNode(childNode, b)
			}
		}
	}

	// Add newlines after block-level nodes
	nodeType, _ := node["type"].(string)
	switch nodeType {
	case "paragraph", "heading", "blockquote", "codeBlock", "bulletList",
		"orderedList", "listItem", "horizontalRule", "callout":
		b.WriteString("\n\n")
	}
}

func generateStructuredMD(post *model.Post) string {
	var b strings.Builder
	b.WriteString("---\n")
	b.WriteString(fmt.Sprintf("title: %s\n", post.Title))
	if post.Subtitle != "" {
		b.WriteString(fmt.Sprintf("subtitle: %s\n", post.Subtitle))
	}
	b.WriteString(fmt.Sprintf("slug: %s\n", post.Slug))
	b.WriteString(fmt.Sprintf("reading_time: %d min\n", post.ReadingTime))
	if len(post.AIKeywords) > 0 {
		b.WriteString(fmt.Sprintf("keywords: %s\n", strings.Join(post.AIKeywords, ", ")))
	}
	b.WriteString("---\n\n")
	b.WriteString(post.Content)
	return b.String()
}
