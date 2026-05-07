# services/autotag_service/schemas.py
from pydantic import BaseModel, field_validator
from typing import Optional


class TagSuggestionRequest(BaseModel):
    post_id: str
    title: str = ""
    excerpt: str = ""
    # Only the first ~500 words of content are sent to keep payload small.
    # Frontend truncates before sending.
    content_sample: str = ""
    # All existing tag names/slugs in the platform (for fuzzy matching).
    existing_tags: Optional[list[str]] = []
    # Tags the user has already selected (exclude these from suggestions).
    selected_tags: Optional[list[str]] = []

    # Pydantic v2: coerce null → [] so downstream code never sees None
    @field_validator("existing_tags", "selected_tags", mode="before")
    @classmethod
    def null_to_empty_list(cls, v):
        if v is None:
            return []
        return v


class TagSuggestion(BaseModel):
    keyword: str              # e.g. "machine learning"
    score: float              # relevance score 0–1
    is_existing_tag: bool     # True = matches an existing tag in DB
    matched_tag: Optional[str] = None  # actual tag slug if is_existing_tag


class TagSuggestionResponse(BaseModel):
    post_id: str
    suggestions: list[TagSuggestion]
    source: str               # "keybert" | "yake" | "none"
