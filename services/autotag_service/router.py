# services/autotag_service/router.py
"""
FastAPI router for auto-tag suggestions.
Mounted into the unified services app so everything runs on one port.
"""

from fastapi import APIRouter

from .models.tag_suggest import extract_keywords, match_against_existing_tags, word_count
from .schemas import TagSuggestionRequest, TagSuggestionResponse, TagSuggestion

router = APIRouter(tags=["autotag"])


def warmup_autotag():
    """Call during app lifespan to pre-load the KeyBERT model."""
    from .models.tag_suggest import get_kw_model
    print("Loading KeyBERT / tag suggestion model...")
    get_kw_model()
    print("KeyBERT loaded.")


@router.post("/suggest/tags", response_model=TagSuggestionResponse)
async def suggest_tags(req: TagSuggestionRequest):
    """
    Extract keywords from post content and match against existing platform tags.
    Called by the Go backend during post editing for real-time tag suggestions.
    """
    # Step 1: Extract keywords
    keywords = extract_keywords(
        title=req.title,
        excerpt=req.excerpt,
        content=req.content_sample,
        top_n=15,
    )

    if not keywords:
        return TagSuggestionResponse(post_id=req.post_id, suggestions=[], source="none")

    # Step 2: Match against existing tags
    enriched = match_against_existing_tags(keywords, req.existing_tags)

    # Step 3: Remove tags the user already selected
    selected_lower = {t.lower().strip() for t in req.selected_tags}
    filtered = [
        e for e in enriched
        if e["keyword"] not in selected_lower
        and (e["matched_tag"] is None or e["matched_tag"] not in selected_lower)
    ]

    # Step 4: Cap at 10 suggestions
    top = filtered[:10]

    # Determine which model ran (for logging/debugging)
    combined_word_count = word_count(
        " ".join(filter(None, [req.title, req.excerpt, req.content_sample]))
    )
    source = "yake" if combined_word_count < 15 else "keybert"

    return TagSuggestionResponse(
        post_id=req.post_id,
        suggestions=[TagSuggestion(**s) for s in top],
        source=source,
    )
