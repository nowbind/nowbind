// backend/internal/moderation/client.go
package moderation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ModerationFlag is a single triggered content policy flag.
type ModerationFlag struct {
	Label     string  `json:"label"`
	Score     float64 `json:"score"`
	Threshold float64 `json:"threshold"`
}

// ModerationResult is the response from the moderation service.
type ModerationResult struct {
	Safe    bool             `json:"safe"`
	Action  string           `json:"action"` // "allow" | "block" | "flag_for_review"
	Flags   []ModerationFlag `json:"flags"`
	Message string           `json:"message,omitempty"`
}

// PostModerationRequest is the payload sent to POST /moderate/post.
type PostModerationRequest struct {
	PostID    string   `json:"post_id"`
	Text      string   `json:"text"`
	ImageURLs []string `json:"image_urls"`
}

// CommentModerationRequest is the payload sent to POST /moderate/comment.
type CommentModerationRequest struct {
	CommentID string `json:"comment_id"`
	Text      string `json:"text"`
}

// Client calls the moderation microservice.
type Client struct {
	baseURL        string
	internalSecret string
	httpClient     *http.Client
}

// NewClient creates a new moderation service client.
func NewClient(baseURL, internalSecret string) *Client {
	return &Client{
		baseURL:        baseURL,
		internalSecret: internalSecret,
		httpClient: &http.Client{
			Timeout: 30 * time.Second, // ML inference can be slow on CPU
		},
	}
}

func (c *Client) post(ctx context.Context, path string, payload any) (*ModerationResult, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Secret", c.internalSecret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("moderation service returned %d", resp.StatusCode)
	}

	var result ModerationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return &result, nil
}

// ModeratePost checks a post's text and images.
func (c *Client) ModeratePost(ctx context.Context, postID, text string, imageURLs []string) (*ModerationResult, error) {
	return c.post(ctx, "/moderate/post", PostModerationRequest{
		PostID:    postID,
		Text:      text,
		ImageURLs: imageURLs,
	})
}

// ModerateComment checks a comment's text.
func (c *Client) ModerateComment(ctx context.Context, commentID, text string) (*ModerationResult, error) {
	return c.post(ctx, "/moderate/comment", CommentModerationRequest{
		CommentID: commentID,
		Text:      text,
	})
}

// ---------------------------------------------------------------------------
// Tag suggestion types + method
// ---------------------------------------------------------------------------

// TagSuggestion is a single suggested tag from the ML service.
type TagSuggestion struct {
	Keyword       string  `json:"keyword"`
	Score         float64 `json:"score"`
	IsExistingTag bool    `json:"is_existing_tag"`
	MatchedTag    *string `json:"matched_tag"`
}

// TagSuggestionRequest is sent to POST /suggest/tags.
type TagSuggestionRequest struct {
	PostID        string   `json:"post_id"`
	Title         string   `json:"title"`
	Excerpt       string   `json:"excerpt"`
	ContentSample string   `json:"content_sample"`
	ExistingTags  []string `json:"existing_tags"`
	SelectedTags  []string `json:"selected_tags"`
}

// TagSuggestionResponse comes back from the ML service.
type TagSuggestionResponse struct {
	PostID      string          `json:"post_id"`
	Suggestions []TagSuggestion `json:"suggestions"`
	Source      string          `json:"source"`
}

// SuggestTags calls the ML service to get tag suggestions for a post.
func (c *Client) SuggestTags(ctx context.Context, req TagSuggestionRequest) (*TagSuggestionResponse, error) {
	// Ensure slices are never nil (JSON null) — Pydantic rejects null for list[str]
	if req.ExistingTags == nil {
		req.ExistingTags = []string{}
	}
	if req.SelectedTags == nil {
		req.SelectedTags = []string{}
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/suggest/tags", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Internal-Secret", c.internalSecret)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Read error body for debugging
		var errBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errBody)
		return nil, fmt.Errorf("ml service returned %d: %v", resp.StatusCode, errBody)
	}

	var result TagSuggestionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return &result, nil
}
