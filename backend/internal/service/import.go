package service

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/pkg"
)

type ImportService struct {
	posts *repository.PostRepository
	tags  *repository.TagRepository
}

func NewImportService(posts *repository.PostRepository, tags *repository.TagRepository) *ImportService {
	return &ImportService{posts: posts, tags: tags}
}

type ImportResult struct {
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

type parsedPost struct {
	title       string
	content     string
	tags        []string
	publishedAt *time.Time
}

func (s *ImportService) ImportMediumZip(ctx context.Context, authorID string, zipReader io.ReaderAt, zipSize int64) (*ImportResult, error) {
	const maxFileSize = 5 << 20  // 5 MB
	const maxFiles = 1000

	zr, err := zip.NewReader(zipReader, zipSize)
	if err != nil {
		return nil, fmt.Errorf("opening zip archive: %w", err)
	}

	result := &ImportResult{}
	fileCount := 0

	for _, f := range zr.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if !strings.HasPrefix(strings.ToLower(f.Name), "posts/") {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(f.Name), ".html") {
			continue
		}

		fileCount++
		if fileCount > maxFiles {
			result.Errors = append(result.Errors, "too many files in archive, limit is 1000")
			break
		}

		if f.UncompressedSize64 > uint64(maxFileSize) {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: file too large (uncompressed)", f.Name))
			result.Skipped++
			continue
		}

		rc, err := f.Open()
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %s", f.Name, err.Error()))
			result.Skipped++
			continue
		}

		raw, err := io.ReadAll(io.LimitReader(rc, int64(maxFileSize)+1))
		rc.Close()
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: reading file: %s", f.Name, err.Error()))
			result.Skipped++
			continue
		}

		if int64(len(raw)) > int64(maxFileSize) {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: file too large", f.Name))
			result.Skipped++
			continue
		}

		parsed := parseMediumHTML(string(raw))
		if parsed.title == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: no title found", f.Name))
			result.Skipped++
			continue
		}

		markdown := htmlToMarkdown(parsed.content)

		post := &model.Post{
			AuthorID:      authorID,
			Slug:          pkg.UniqueSlug(parsed.title),
			Title:         parsed.title,
			Content:       markdown,
			ContentFormat: "markdown",
			Excerpt:       excerptFromContent(markdown),
			Status:        "draft",
			ReadingTime:   pkg.EstimateReadingTime(markdown),
		}

		// Temporary TipTap skeleton so the editor can load without a blank page
		rawJSON := map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "Imported content. You may need to copy/paste the original Markdown for rich editing.",
						},
					},
				},
			},
		}
		if b, err := json.Marshal(rawJSON); err == nil {
			jsonStr := string(b)
			post.ContentJSON = &jsonStr
		}

		post.AIKeywords = extractKeywords(parsed.title, markdown)
		post.StructuredMD = generateStructuredMD(post)

		if err := s.posts.Create(ctx, post); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: creating post: %s", f.Name, err.Error()))
			result.Skipped++
			continue
		}

		if len(parsed.tags) > 0 {
			tagIDs, err := s.ensureTags(ctx, parsed.tags)
			if err == nil {
				_ = s.posts.SetTags(ctx, post.ID, tagIDs)
			}
		}

		result.Imported++
	}

	return result, nil
}

func (s *ImportService) ensureTags(ctx context.Context, names []string) ([]string, error) {
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

// parseMediumHTML extracts title, content body, tags, and published date from a Medium HTML export.
func parseMediumHTML(html string) parsedPost {
	p := parsedPost{}

	// Extract title from <h1> first, then <title>
	p.title = extractTagContent(html, "h1")
	if p.title == "" {
		p.title = extractTagContent(html, "title")
	}
	p.title = strings.TrimSpace(cleanHTML(p.title))

	// Extract content from <article>, fallback to <body>
	p.content = extractTagContent(html, "article")
	if p.content == "" {
		p.content = extractTagContent(html, "body")
	}

	// Extract tags from <a> elements with "tag" in class
	tagRe := regexp.MustCompile(`(?i)<a[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)</a>`)
	for _, m := range tagRe.FindAllStringSubmatch(html, -1) {
		tag := strings.TrimSpace(m[1])
		if tag != "" {
			p.tags = append(p.tags, tag)
		}
	}

	// Extract published date from <time> element
	timeRe := regexp.MustCompile(`(?i)<time[^>]*datetime="([^"]+)"`)
	if m := timeRe.FindStringSubmatch(html); len(m) > 1 {
		if t, err := time.Parse(time.RFC3339, m[1]); err == nil {
			p.publishedAt = &t
		} else if t, err := time.Parse("2006-01-02", m[1]); err == nil {
			p.publishedAt = &t
		}
	}

	return p
}

// extractTagContent returns the inner HTML of the first occurrence of the given tag.
func extractTagContent(html, tag string) string {
	re := regexp.MustCompile(`(?is)<` + tag + `[^>]*>(.*?)</` + tag + `>`)
	m := re.FindStringSubmatch(html)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}

// --- HTML to Markdown converter ---

// htmlToMarkdown converts HTML content to clean Markdown.
func htmlToMarkdown(html string) string {
	s := html

	// Normalize whitespace between tags
	s = regexp.MustCompile(`>\s+<`).ReplaceAllString(s, "> <")

	// Handle figures: extract img + figcaption
	figureRe := regexp.MustCompile(`(?is)<figure[^>]*>(.*?)</figure>`)
	s = figureRe.ReplaceAllStringFunc(s, func(match string) string {
		img := convertImg(match)
		caption := extractTagContent(match, "figcaption")
		caption = cleanHTML(caption)
		if caption != "" {
			return img + "\n*" + strings.TrimSpace(caption) + "*\n\n"
		}
		return img + "\n\n"
	})

	// Headings h1-h6
	for i := 6; i >= 1; i-- {
		prefix := strings.Repeat("#", i)
		re := regexp.MustCompile(fmt.Sprintf(`(?is)<h%d[^>]*>(.*?)</h%d>`, i, i))
		s = re.ReplaceAllStringFunc(s, func(match string) string {
			m := re.FindStringSubmatch(match)
			if len(m) < 2 {
				return match
			}
			text := strings.TrimSpace(cleanInline(m[1]))
			return "\n\n" + prefix + " " + text + "\n\n"
		})
	}

	// Blockquotes
	bqRe := regexp.MustCompile(`(?is)<blockquote[^>]*>(.*?)</blockquote>`)
	s = bqRe.ReplaceAllStringFunc(s, func(match string) string {
		m := bqRe.FindStringSubmatch(match)
		if len(m) < 2 {
			return match
		}
		inner := strings.TrimSpace(cleanInline(cleanBlock(m[1])))
		lines := strings.Split(inner, "\n")
		var quoted []string
		for _, line := range lines {
			quoted = append(quoted, "> "+strings.TrimSpace(line))
		}
		return "\n\n" + strings.Join(quoted, "\n") + "\n\n"
	})

	// Code blocks: <pre> containing <code>
	preRe := regexp.MustCompile(`(?is)<pre[^>]*>(.*?)</pre>`)
	s = preRe.ReplaceAllStringFunc(s, func(match string) string {
		m := preRe.FindStringSubmatch(match)
		if len(m) < 2 {
			return match
		}
		inner := m[1]
		// Extract code from inner <code> tag if present
		codeInner := extractTagContent(inner, "code")
		if codeInner != "" {
			inner = codeInner
		}
		inner = decodeHTMLEntities(inner)
		inner = cleanHTML(inner)
		return "\n\n```\n" + strings.TrimSpace(inner) + "\n```\n\n"
	})

	// Unordered lists
	ulRe := regexp.MustCompile(`(?is)<ul[^>]*>(.*?)</ul>`)
	s = ulRe.ReplaceAllStringFunc(s, func(match string) string {
		return "\n\n" + convertList(match, "ul") + "\n\n"
	})

	// Ordered lists
	olRe := regexp.MustCompile(`(?is)<ol[^>]*>(.*?)</ol>`)
	s = olRe.ReplaceAllStringFunc(s, func(match string) string {
		return "\n\n" + convertList(match, "ol") + "\n\n"
	})

	// Images (standalone, not inside figure which was already handled)
	imgRe := regexp.MustCompile(`(?i)<img[^>]*>`)
	s = imgRe.ReplaceAllStringFunc(s, convertImg)

	// Paragraphs
	pRe := regexp.MustCompile(`(?is)<p[^>]*>(.*?)</p>`)
	s = pRe.ReplaceAllStringFunc(s, func(match string) string {
		m := pRe.FindStringSubmatch(match)
		if len(m) < 2 {
			return match
		}
		text := strings.TrimSpace(cleanInline(m[1]))
		if text == "" {
			return ""
		}
		return "\n\n" + text + "\n\n"
	})

	// Horizontal rules
	s = regexp.MustCompile(`(?i)<hr[^>]*/?\s*>`).ReplaceAllString(s, "\n\n---\n\n")

	// Line breaks
	s = regexp.MustCompile(`(?i)<br\s*/?\s*>`).ReplaceAllString(s, "\n")

	// Strip remaining HTML tags
	s = cleanHTML(s)

	// Decode HTML entities
	s = decodeHTMLEntities(s)

	// Clean up excessive newlines
	s = regexp.MustCompile(`\n{3,}`).ReplaceAllString(s, "\n\n")
	s = strings.TrimSpace(s)

	return s
}

// cleanInline converts inline HTML elements to Markdown.
func cleanInline(s string) string {
	// Bold
	boldRe := regexp.MustCompile(`(?is)<(strong|b)>(.*?)</(strong|b)>`)
	s = boldRe.ReplaceAllString(s, "**$2**")

	// Italic
	emRe := regexp.MustCompile(`(?is)<(em|i)>(.*?)</(em|i)>`)
	s = emRe.ReplaceAllString(s, "*$2*")

	// Inline code
	codeRe := regexp.MustCompile(`(?is)<code>(.*?)</code>`)
	s = codeRe.ReplaceAllString(s, "`$1`")

	// Links
	linkRe := regexp.MustCompile(`(?is)<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>`)
	s = linkRe.ReplaceAllString(s, "[$2]($1)")

	// Images inside inline context
	imgRe := regexp.MustCompile(`(?i)<img[^>]*>`)
	s = imgRe.ReplaceAllStringFunc(s, convertImg)

	return s
}

// cleanBlock strips block-level tags but preserves their content after inline conversion.
func cleanBlock(s string) string {
	s = cleanInline(s)
	// Strip p tags
	s = regexp.MustCompile(`(?is)<p[^>]*>(.*?)</p>`).ReplaceAllString(s, "$1\n")
	// Strip div tags
	s = regexp.MustCompile(`(?is)<div[^>]*>(.*?)</div>`).ReplaceAllString(s, "$1\n")
	return s
}

// convertImg converts an <img> tag to Markdown image syntax.
func convertImg(tag string) string {
	srcRe := regexp.MustCompile(`(?i)src="([^"]*)"`)
	altRe := regexp.MustCompile(`(?i)alt="([^"]*)"`)

	src := ""
	alt := ""
	if m := srcRe.FindStringSubmatch(tag); len(m) > 1 {
		src = m[1]
	}
	if m := altRe.FindStringSubmatch(tag); len(m) > 1 {
		alt = m[1]
	}

	if src == "" {
		return ""
	}
	return fmt.Sprintf("![%s](%s)", alt, src)
}

// convertList converts a <ul> or <ol> block to Markdown list items.
func convertList(html, listType string) string {
	liRe := regexp.MustCompile(`(?is)<li[^>]*>(.*?)</li>`)
	matches := liRe.FindAllStringSubmatch(html, -1)

	var lines []string
	for i, m := range matches {
		if len(m) < 2 {
			continue
		}
		text := strings.TrimSpace(cleanInline(cleanHTML(m[1])))
		if text == "" {
			continue
		}
		if listType == "ol" {
			lines = append(lines, fmt.Sprintf("%d. %s", i+1, text))
		} else {
			lines = append(lines, "- "+text)
		}
	}
	return strings.Join(lines, "\n")
}

// cleanHTML strips all HTML tags, preserving text content.
func cleanHTML(s string) string {
	return regexp.MustCompile(`<[^>]*>`).ReplaceAllString(s, "")
}

// decodeHTMLEntities decodes common HTML entities.
func decodeHTMLEntities(s string) string {
	replacer := strings.NewReplacer(
		"&amp;", "&",
		"&lt;", "<",
		"&gt;", ">",
		"&quot;", `"`,
		"&#39;", "'",
		"&apos;", "'",
		"&nbsp;", " ",
		"&#x27;", "'",
		"&#x2F;", "/",
		"&mdash;", "\u2014",
		"&ndash;", "\u2013",
		"&hellip;", "\u2026",
		"&lsquo;", "\u2018",
		"&rsquo;", "\u2019",
		"&ldquo;", "\u201c",
		"&rdquo;", "\u201d",
	)
	return replacer.Replace(s)
}

// excerptFromContent returns the first 300 characters of content as an excerpt.
func excerptFromContent(content string) string {
	if len(content) > 300 {
		return content[:300] + "..."
	}
	return content
}
