# services/autotag_service/models/tag_suggest.py
"""
KeyBERT + YAKE keyword extraction for auto-tag suggestions.
Uses the all-MiniLM-L6-v2 sentence transformer (same one used
elsewhere in the platform) — no extra model download needed.
"""

import re
import yake
from keybert import KeyBERT
from rapidfuzz import fuzz, process
from sentence_transformers import SentenceTransformer

# Lazy-loaded singletons — warm up at startup via get_kw_model()
_sentence_model = None
_kw_model = None


def get_kw_model():
    """Return the KeyBERT model, loading it on first call."""
    global _sentence_model, _kw_model
    if _kw_model is None:
        _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
        _kw_model = KeyBERT(model=_sentence_model)
    return _kw_model


def get_yake():
    """YAKE extractor for short texts (title-only, <20 words)."""
    return yake.KeywordExtractor(
        lan="en",
        n=2,          # up to bigrams
        top=10,
        dedupLim=0.7,
    )


def strip_markdown(text: str) -> str:
    """Strip markdown syntax so KeyBERT sees plain prose."""
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"`[^`]+`", " ", text)
    text = re.sub(r"!\[.*?\]\(.*?\)", " ", text)
    text = re.sub(r"\[.*?\]\(.*?\)", " ", text)
    text = re.sub(r"[#*_>~|]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def word_count(text: str) -> int:
    return len(text.split())


def extract_keywords(title: str, excerpt: str, content: str, top_n: int = 10) -> list[dict]:
    """
    Extract keywords from the combination of title, excerpt, and content.
    Title is weighted higher by repeating it 3× in the combined document.

    Returns list of {"keyword": str, "score": float}
    """
    clean_title = strip_markdown(title or "")
    clean_excerpt = strip_markdown(excerpt or "")
    clean_content = strip_markdown(content or "")

    # Weight: title × 3, excerpt × 2, content × 1
    combined = " ".join(filter(None, [
        clean_title, clean_title, clean_title,
        clean_excerpt, clean_excerpt,
        clean_content,
    ])).strip()

    if not combined:
        return []

    total_words = word_count(combined)

    if total_words < 15:
        # Text too short for KeyBERT — use YAKE (statistical, works on tiny text)
        kw_extractor = get_yake()
        # YAKE returns (keyword, score) where lower score = better
        raw = kw_extractor.extract_keywords(combined)
        # Normalize: invert YAKE score to 0–1 range
        keywords = [
            {"keyword": kw.lower().strip(), "score": round(1 / (1 + score), 4)}
            for kw, score in raw
        ]
        return sorted(keywords, key=lambda x: x["score"], reverse=True)[:top_n]

    # KeyBERT for normal-length text
    kw_model = get_kw_model()
    results = kw_model.extract_keywords(
        combined,
        keyphrase_ngram_range=(1, 2),   # single words and two-word phrases
        stop_words="english",
        use_mmr=True,                   # Maximal Marginal Relevance: reduces redundancy
        diversity=0.3,                  # lowered to keep tags highly relevant instead of weirdly diverse
        top_n=top_n,
    )

    return [
        {"keyword": kw.lower().strip(), "score": round(score, 4)}
        for kw, score in results
    ]


def match_against_existing_tags(
    keywords: list[dict],
    existing_tags: list[str],       # all tag slugs/names from DB
    fuzzy_threshold: int = 82,      # 0–100, higher = stricter match
) -> list[dict]:
    """
    For each extracted keyword, check if it fuzzy-matches an existing tag.
    Returns enriched keyword dicts with is_existing_tag and matched_tag fields.
    """
    enriched = []
    for item in keywords:
        kw = item["keyword"]

        if not existing_tags:
            enriched.append({
                **item,
                "is_existing_tag": False,
                "matched_tag": None,
            })
            continue

        match = process.extractOne(
            kw,
            existing_tags,
            scorer=fuzz.WRatio,
            score_cutoff=fuzzy_threshold,
        )
        if match:
            enriched.append({
                **item,
                "is_existing_tag": True,
                "matched_tag": match[0],   # the actual tag name/slug from DB
            })
        else:
            enriched.append({
                **item,
                "is_existing_tag": False,
                "matched_tag": None,
            })

    # Sort: existing tags first (they're safer to suggest), then by score
    enriched.sort(key=lambda x: (not x["is_existing_tag"], -x["score"]))
    return enriched
