# moderation-service/models/text_nsfw.py
import re
from detoxify import Detoxify

# Load once at startup
_model = None

# Thresholds per label — tune based on your community standards
THRESHOLDS = {
    "toxicity": 0.65,
    "severe_toxicity": 0.50,
    "obscene": 0.65,
    "threat": 0.60,
    "insult": 0.75,
    "identity_attack": 0.65,
    "sexual_explicit": 0.55,
}

# Explicit NSFW keywords — always flag regardless of model score.
# These are matched as whole words (case-insensitive) so they won't
# trigger on substrings like "document" or "assume".
NSFW_KEYWORDS = {
    "porn", "porno", "pornography", "hentai", "xxx",
    "nsfw", "nude", "nudes", "nudity", "naked",
    "sex", "sexting", "sexual", "sexually",
    "fuck", "fucking", "fucked", "fucker",
    "shit", "shitty", "bullshit",
    "dick", "cock", "penis", "vagina", "pussy",
    "boobs", "tits", "titties", "ass", "asses",
    "masturbat", "orgasm", "erotic", "erotica",
    "cum", "cumshot", "blowjob", "handjob",
    "slut", "whore", "bitch",
    "rape", "molest",
}

# Build regex pattern for whole-word matching
_KEYWORD_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(kw) for kw in NSFW_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


def get_model():
    global _model
    if _model is None:
        # 'unbiased' uses unitary/unbiased-toxic-roberta
        _model = Detoxify("unbiased")
    return _model


def strip_markdown(text: str) -> str:
    """Remove markdown syntax so the model sees plain text."""
    # Remove code blocks
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"`[^`]+`", " ", text)
    # Remove images and links
    text = re.sub(r"!\[.*?\]\(.*?\)", " ", text)
    text = re.sub(r"\[.*?\]\(.*?\)", " ", text)
    # Remove headings, bold, italic
    text = re.sub(r"[#*_>~|]", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def check_text(raw_text: str) -> list[dict]:
    """
    Run toxicity + NSFW detection on text.
    Returns a list of triggered flags (empty if safe).
    """
    text = strip_markdown(raw_text)
    if not text:
        return []

    flags = []

    # ---- 1. Keyword-based detection (fast, reliable) ----
    found_keywords = set(_KEYWORD_PATTERN.findall(text.lower()))
    if found_keywords:
        flags.append({
            "label": "explicit_keywords",
            "score": 1.0,
            "threshold": 0.0,
            "matched_keywords": list(found_keywords),
        })

    # ---- 2. ML model-based detection (Detoxify) ----
    model = get_model()
    scores: dict = model.predict(text)

    for label, threshold in THRESHOLDS.items():
        score = scores.get(label, 0.0)
        if score >= threshold:
            flags.append({
                "label": label,
                "score": round(score, 4),
                "threshold": threshold,
            })

    return flags
