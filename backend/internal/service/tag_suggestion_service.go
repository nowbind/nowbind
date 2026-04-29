package service

import (
	"context"
	"log"

	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/moderation"
	"github.com/nowbind/nowbind/internal/repository"
)

// TagSuggestionService encapsulates ML-powered tag suggestion logic.
type TagSuggestionService struct {
	client  *moderation.Client
	tagRepo *repository.TagRepository
}

// NewTagSuggestionService creates a TagSuggestionService.
func NewTagSuggestionService(client *moderation.Client, tagRepo *repository.TagRepository) *TagSuggestionService {
	return &TagSuggestionService{client: client, tagRepo: tagRepo}
}

// Enabled returns true when the ML service is configured.
func (s *TagSuggestionService) Enabled() bool {
	return s.client != nil
}

// SuggestTagsInput is the request payload for tag suggestion.
type SuggestTagsInput struct {
	PostID        string
	Title         string
	Excerpt       string
	ContentSample string
	SelectedTags  []string
}

// SuggestTagsResult is the response from the ML tag suggestion.
type SuggestTagsResult struct {
	Suggestions []moderation.TagSuggestion
	Source      string
}

// SuggestTags calls the ML service, persists suggestions, and returns them.
func (s *TagSuggestionService) SuggestTags(ctx context.Context, input SuggestTagsInput) (*SuggestTagsResult, error) {
	if s.client == nil {
		return &SuggestTagsResult{Suggestions: []moderation.TagSuggestion{}}, nil
	}

	// Fetch all existing tag names from DB for fuzzy matching
	existingTags, err := s.tagRepo.GetAllTagNames(ctx)
	if err != nil {
		log.Printf("SuggestTags: failed to get tags: %v", err)
		existingTags = []string{}
	}

	mlReq := moderation.TagSuggestionRequest{
		PostID:        input.PostID,
		Title:         input.Title,
		Excerpt:       input.Excerpt,
		ContentSample: input.ContentSample,
		ExistingTags:  existingTags,
		SelectedTags:  input.SelectedTags,
	}

	result, err := s.client.SuggestTags(ctx, mlReq)
	if err != nil {
		// ML service unavailable — don't fail, return empty list
		log.Printf("SuggestTags: ml service error: %v", err)
		return &SuggestTagsResult{Suggestions: []moderation.TagSuggestion{}}, nil
	}

	// Persist suggestions to DB in the background (regardless of whether user accepts them)
	if len(result.Suggestions) > 0 {
		go s.storeSuggestions(input.PostID, result.Suggestions)
	}

	return &SuggestTagsResult{
		Suggestions: result.Suggestions,
		Source:      result.Source,
	}, nil
}

// storeSuggestions persists ML-suggested tags in the background.
func (s *TagSuggestionService) storeSuggestions(postID string, suggestions []moderation.TagSuggestion) {
	ctx := context.Background()
	for _, sug := range suggestions {
		matchedTag := ""
		if sug.MatchedTag != nil {
			matchedTag = *sug.MatchedTag
		}
		if err := s.tagRepo.UpsertSuggestedTag(ctx, postID, sug.Keyword, sug.Score, sug.IsExistingTag, matchedTag); err != nil {
			log.Printf("StoreSuggestedTags: %v", err)
		}
	}
}

// AcceptSuggestion marks a suggestion as accepted or dismissed.
func (s *TagSuggestionService) AcceptSuggestion(ctx context.Context, postID, keyword string, accepted bool) error {
	if err := s.tagRepo.MarkSuggestionAccepted(ctx, postID, keyword, accepted); err != nil {
		log.Printf("AcceptTagSuggestion: %v", err)
		return err
	}
	return nil
}

// GetSuggestions returns persisted tag suggestions for a post.
func (s *TagSuggestionService) GetSuggestions(ctx context.Context, postID string) ([]model.PostTagSuggestion, error) {
	suggestions, err := s.tagRepo.GetSuggestionsForPost(ctx, postID)
	if err != nil {
		log.Printf("GetSuggestions: %v", err)
		return nil, err
	}
	return suggestions, nil
}
