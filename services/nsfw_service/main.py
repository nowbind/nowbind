"""NSFW / Spam content moderation sub-service.

Exports:
    router   – FastAPI APIRouter with /moderate/post, /moderate/comment, /health
    lifespan – async context manager that warms up ML models at startup
"""

from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI

from .schemas import (
    PostModerationRequest,
    CommentModerationRequest,
    ModerationResult,
    ModerationFlag,
)
from .models.image_nsfw import check_image
from .models.text_nsfw import check_text
from .models.spam import check_spam


# ---------------------------------------------------------------------------
# Lifespan — warm up heavy ML models once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    from .models.text_nsfw import get_model
    from .models.image_nsfw import get_pipeline
    from .models.spam import get_pipeline as get_spam_pipeline

    print("Loading text NSFW model...")
    get_model()
    print("Loading image NSFW model...")
    get_pipeline()
    print("Loading spam model...")
    get_spam_pipeline()
    print("All NSFW/spam models loaded.")
    yield


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["moderation"])


def decide_action(flags: list[dict]) -> tuple[bool, str]:
    """
    Given a list of triggered flags, decide what to do.
    Returns (safe: bool, action: str)
    """
    if not flags:
        return True, "allow"

    # Hard block labels — always block regardless of score
    hard_block_exact = {
        "severe_toxicity", "threat", "nsfw_image",
        "sexual_explicit", "explicit_keywords", "spam_ml",
    }
    # Prefix-based blocks (catches all spam_heuristic_* labels)
    hard_block_prefixes = ("spam_heuristic_",)

    for f in flags:
        label = f["label"]
        if label in hard_block_exact:
            return False, "block"
        if any(label.startswith(p) for p in hard_block_prefixes):
            return False, "block"

    # If multiple medium flags → block
    if len(flags) >= 2:
        return False, "block"

    # Single medium flag → flag for human review
    return False, "flag_for_review"


@router.post("/moderate/post", response_model=ModerationResult)
async def moderate_post(req: PostModerationRequest):
    all_flags = []

    # 1. Check post text (NSFW + spam)
    text_nsfw_flags = check_text(req.text)
    all_flags.extend(text_nsfw_flags)

    spam_flags = check_spam(req.text)
    all_flags.extend(spam_flags)

    # 2. Check every image in the post
    for url in req.image_urls:
        try:
            result = await check_image(str(url))
            if not result["safe"]:
                all_flags.append({
                    "label": result["label"],
                    "score": result["score"],
                    "threshold": result["threshold"],
                })
        except Exception as e:
            # Log but don't fail the whole request if one image is unreachable
            print(f"Image check failed for {url}: {e}")

    safe, action = decide_action(all_flags)

    message = None
    if not safe:
        message = _friendly_message(all_flags, action, "post")

    return ModerationResult(
        safe=safe,
        action=action,
        flags=[ModerationFlag(**f) for f in all_flags],
        message=message,
    )


@router.post("/moderate/comment", response_model=ModerationResult)
async def moderate_comment(req: CommentModerationRequest):
    all_flags = []

    text_nsfw_flags = check_text(req.text)
    all_flags.extend(text_nsfw_flags)

    spam_flags = check_spam(req.text)
    all_flags.extend(spam_flags)

    safe, action = decide_action(all_flags)

    message = None
    if not safe:
        message = _friendly_message(all_flags, action, "comment")

    return ModerationResult(
        safe=safe,
        action=action,
        flags=[ModerationFlag(**f) for f in all_flags],
        message=message,
    )


@router.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Human-friendly messages  (technical labels stay in `flags` for devtools)
# ---------------------------------------------------------------------------

_LABEL_REASONS: dict[str, str] = {
    "nsfw_image": "inappropriate or explicit imagery",
    "sexual_explicit": "sexually explicit language",
    "explicit_keywords": "prohibited language",
    "severe_toxicity": "highly toxic or hateful language",
    "toxicity": "toxic language",
    "threat": "threatening language",
    "insult": "insulting language",
    "identity_attack": "identity-based attacks",
    "obscene": "obscene language",
    "spam_ml": "spam-like content",
    "spam_heuristic_repeated_word": "repetitive content",
    "spam_heuristic_low_vocabulary": "repetitive content",
    "spam_heuristic_char_repetition": "repetitive characters",
    "spam_heuristic_repeated_sentences": "duplicate content",
    "spam_heuristic_excessive_links": "too many links",
    "spam_heuristic_spam_phrases": "spam-like phrases",
}


def _friendly_reason(label: str) -> str:
    """Map a technical flag label to a short, user-friendly reason."""
    if label in _LABEL_REASONS:
        return _LABEL_REASONS[label]
    if label.startswith("spam_heuristic_"):
        return "spam-like content"
    return "content policy concern"


def _friendly_message(flags: list[dict], action: str, entity: str) -> str:
    """Build a clean, user-facing message from the triggered flags."""
    reasons = list(dict.fromkeys(  # deduplicate while preserving order
        _friendly_reason(f["label"]) for f in flags
    ))
    reason_text = ", ".join(reasons)

    if action == "block":
        return (
            f"Your {entity} could not be saved because it contains "
            f"{reason_text}. Please review our community guidelines and "
            f"update your content."
        )
    return (
        f"Your {entity} has been flagged for review due to {reason_text}. "
        f"It will remain a draft until a moderator approves it."
    )
