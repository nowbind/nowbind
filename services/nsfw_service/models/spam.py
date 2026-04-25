# moderation-service/models/spam.py
import re
from collections import Counter
from transformers import pipeline

_pipe = None
SPAM_THRESHOLD = 0.85


def get_pipeline():
    global _pipe
    if _pipe is None:
        _pipe = pipeline(
            "text-classification",
            model="mrm8488/bert-tiny-finetuned-sms-spam-detection",
            device=-1,
        )
    return _pipe


# Heuristic rules for blog-specific spam (link farms, SEO spam, repetition)
def heuristic_spam_check(text: str) -> list[str]:
    reasons = []

    # --- 1. Too many external links (more than 10 = suspicious) ---
    urls = re.findall(r"https?://\S+", text)
    if len(urls) > 10:
        reasons.append(f"excessive_links:{len(urls)}")

    # --- 2. Repeated identical sentences (copy-paste spam) ---
    sentences = [s.strip() for s in re.split(r"[.!?\n]", text) if len(s.strip()) > 10]
    if len(sentences) > 3:
        unique = set(sentences)
        duplicates = len(sentences) - len(unique)
        if duplicates > 2:
            reasons.append(f"repeated_sentences:{duplicates}")

    # --- 3. Repeated words ---
    words = text.lower().split()
    if len(words) >= 10:
        word_counts = Counter(words)
        most_common_word, most_common_count = word_counts.most_common(1)[0]
        repetition_ratio = most_common_count / len(words)
        # If a single word makes up >60% of all words, it's repetition spam
        if repetition_ratio > 0.6 and most_common_count >= 8:
            reasons.append(f"repeated_word:{most_common_word}:{most_common_count}")

    # --- 4. Very low unique word ratio (gibberish / keyboard spam) ---
    if len(words) >= 15:
        unique_ratio = len(set(words)) / len(words)
        if unique_ratio < 0.15:
            reasons.append(f"low_vocabulary:{unique_ratio:.2f}")

    # --- 5. Excessive character repetition ---
    char_repeat = re.findall(r"(.)\1{9,}", text) 
    if char_repeat:
        reasons.append(f"char_repetition:{len(char_repeat)}")

    # --- 6. Typical spam phrases ---
    spam_patterns = [
        r"\bclick here\b", r"\bbuy now\b", r"\bfree money\b",
        r"\bcasino\b", r"\bviagra\b", r"\bweight loss guarantee\b",
        r"\bearn \$\d+", r"\bmake money fast\b",
        r"\bact now\b", r"\blimited time offer\b",
        r"\bcongratulations.*won\b", r"\bclaim your prize\b",
    ]
    matched = [p for p in spam_patterns if re.search(p, text, re.IGNORECASE)]
    if matched:
        reasons.append(f"spam_phrases:{len(matched)}")

    return reasons


def check_spam(text: str) -> list[dict]:
    """
    Returns list of spam flags. Empty = not spam.
    Combines BERT model + heuristic rules.
    """
    flags = []

    # ML model check (works best on short text / comments)
    pipe = get_pipeline()
    # Truncate to 512 tokens worth of chars for the tiny model
    truncated = text[:2000]
    result = pipe(truncated)[0]

    if result["label"] == "spam" and result["score"] >= SPAM_THRESHOLD:
        flags.append({
            "label": "spam_ml",
            "score": round(result["score"], 4),
            "threshold": SPAM_THRESHOLD,
        })

    # Heuristic check (works better on long blog posts)
    heuristic_reasons = heuristic_spam_check(text)
    for reason in heuristic_reasons:
        flags.append({
            "label": f"spam_heuristic_{reason.split(':')[0]}",
            "score": 1.0,
            "threshold": 1.0,
        })

    return flags
