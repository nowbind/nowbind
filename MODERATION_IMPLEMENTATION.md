# NowBind — Content Moderation Implementation Guide

> **Purpose:** Step-by-step implementation plan for adding NSFW image/text detection and spam
> detection to NowBind. Written to be followed directly by GitHub Copilot or a developer.

---

## Table of Contents

1. [Architecture Decision](#1-architecture-decision)
2. [Models Selected](#2-models-selected)
3. [New Service: `moderation-service` (FastAPI)](#3-new-service-moderation-service-fastapi)
4. [Go Backend Changes](#4-go-backend-changes)
5. [Database Migration](#5-database-migration)
6. [Frontend Changes](#6-frontend-changes)
7. [What Happens on Detection](#7-what-happens-on-detection)
8. [Environment Variables](#8-environment-variables)
9. [Docker Compose Update](#9-docker-compose-update)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Architecture Decision

### ✅ Separate Microservice (not integrated into Go backend)

**Why a separate Python FastAPI service, not inside the Go backend:**

| Concern | Reason |
|---|---|
| ML ecosystem | PyTorch, HuggingFace `transformers`, and `detoxify` are Python-native; adding them to Go is impractical |
| Independent scaling | Moderation can be GPU-accelerated independently without bloating the Go server |
| Isolation | A crash or OOM in ML inference doesn't take down the main API |
| Async workloads | FastAPI handles async inference well; Go can fire-and-forget or wait synchronously |
| Consistency | NowBind's interview trainer also uses FastAPI for ML — same pattern |

**Call flow:**

```
Client → Go Backend (chi) → [POST /api/v1/posts/{id}/publish]
                                      │
                          calls moderation-service
                                      │
                          ┌─────────────────────┐
                          │  moderation-service  │
                          │  (FastAPI, port 8090)│
                          │  - text NSFW check   │
                          │  - text spam check   │
                          │  - image NSFW check  │
                          └─────────────────────┘
                                      │
                          returns ModerationResult
                                      │
                     Go: allow publish OR reject with reason
```

**Moderation is called at these Go handler hooks:**
- `POST /api/v1/posts/{id}/publish` → scan post body + all image URLs
- `POST /api/v1/posts/{id}/comments` → scan comment text
- Image upload endpoint (R2) → scan image before storing

---

## 2. Models Selected

### 2a. Image NSFW Detection

**Primary: `Falconsai/nsfw_image_detection`**
- Architecture: ViT (Vision Transformer) fine-tuned from `google/vit-base-patch16-224-in21k`
- Accuracy: **98.04%** on 80,000-image proprietary dataset
- Downloads: 80M+ on HuggingFace (most popular open-source NSFW image model)
- Output classes: `normal`, `nsfw`
- Input: 224×224 image
- HuggingFace: https://huggingface.co/Falconsai/nsfw_image_detection

**Fallback / secondary: `Marqo/nsfw-image-detection-384`**
- 18–20× smaller than Falconsai, accuracy **98.56%**
- Use this if memory is constrained (it is a ViT-tiny variant)
- HuggingFace: https://huggingface.co/Marqo/nsfw-image-detection-384

### 2b. Text NSFW / Toxicity Detection

**Primary: `unitary/unbiased-toxic-roberta` via the `detoxify` library**
- Architecture: RoBERTa fine-tuned on Jigsaw Unintended Bias dataset
- Multi-label output: `toxicity`, `severe_toxicity`, `obscene`, `threat`, `insult`, `identity_attack`, `sexual_explicit`
- This is exactly what you need — `sexual_explicit` catches NSFW text, `toxicity` catches hate/abuse
- Library: `pip install detoxify`
- HuggingFace: https://huggingface.co/unitary/unbiased-toxic-roberta

**Secondary (lightweight): `michellejieli/inappropriate_text_classifier`**
- Architecture: DistilBERT fine-tuned on 19,604 Reddit posts
- Binary: `NSFW` / `SFW`
- Faster inference, use as a pre-filter before running Detoxify

### 2c. Spam Detection

**Primary: `mrm8488/bert-tiny-finetuned-sms-spam-detection`**
- Architecture: BERT-tiny, very fast
- Binary: `spam` / `ham`
- Good for short comment spam

**For blog post body spam (SEO spam, link farms, low-effort AI content):**
- Use heuristic rules (see Section 3) combined with the BERT model
- No single HuggingFace model covers blog-specific spam perfectly; rules + BERT is the right approach

> **Do NOT write your own NLP from scratch.** These pre-trained models replace all that.
> You only need to call their inference APIs via Python.

---

## 3. New Service: `moderation-service` (FastAPI)

### 3a. File Structure

Create a new top-level directory in the NowBind repo:

```
nowbind/
└── moderation-service/
    ├── main.py
    ├── models/
    │   ├── image_nsfw.py
    │   ├── text_nsfw.py
    │   └── spam.py
    ├── schemas.py
    ├── requirements.txt
    ├── Dockerfile
    └── .env.example
```

### 3b. `requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
detoxify==0.5.2
transformers==4.44.2
torch==2.4.0
torchvision==0.19.0
Pillow==10.4.0
httpx==0.27.2
python-multipart==0.0.9
pydantic==2.8.2
```

> **Note:** If deploying on CPU only, use `torch==2.4.0+cpu` from PyTorch CPU wheel index.

### 3c. `schemas.py`

```python
# moderation-service/schemas.py
from pydantic import BaseModel, HttpUrl
from typing import Optional


class TextModerationRequest(BaseModel):
    text: str                        # full post body (markdown stripped) or comment


class ImageModerationRequest(BaseModel):
    image_url: HttpUrl               # publicly accessible URL of the image


class ModerationFlag(BaseModel):
    label: str                       # e.g. "nsfw_image", "sexual_explicit", "spam"
    score: float                     # confidence 0.0 – 1.0
    threshold: float                 # threshold that was applied


class ModerationResult(BaseModel):
    safe: bool                       # False = block content
    action: str                      # "allow" | "block" | "flag_for_review"
    flags: list[ModerationFlag]      # what triggered, empty if safe
    message: Optional[str] = None   # human-readable reason (shown to author)


class PostModerationRequest(BaseModel):
    post_id: str
    text: str                        # full markdown body, will be stripped
    image_urls: list[HttpUrl] = []   # all images found in the post


class CommentModerationRequest(BaseModel):
    comment_id: str
    text: str
```

### 3d. `models/image_nsfw.py`

```python
# moderation-service/models/image_nsfw.py
import io
import httpx
from PIL import Image
from transformers import pipeline

# Load once at startup — do NOT reload per request
_pipe = None


def get_pipeline():
    global _pipe
    if _pipe is None:
        _pipe = pipeline(
            "image-classification",
            model="Falconsai/nsfw_image_detection",
            # use device=0 if CUDA GPU is available, else -1 for CPU
            device=-1,
        )
    return _pipe


NSFW_THRESHOLD = 0.75   # tune this: lower = stricter


async def check_image(image_url: str) -> dict:
    """
    Download the image from image_url and run NSFW inference.
    Returns {"safe": bool, "score": float, "label": str}
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(str(image_url))
        response.raise_for_status()

    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    pipe = get_pipeline()
    results = pipe(image)

    # results is like [{"label": "nsfw", "score": 0.97}, {"label": "normal", "score": 0.03}]
    nsfw_result = next((r for r in results if r["label"] == "nsfw"), None)
    nsfw_score = nsfw_result["score"] if nsfw_result else 0.0

    return {
        "safe": nsfw_score < NSFW_THRESHOLD,
        "score": nsfw_score,
        "label": "nsfw_image",
        "threshold": NSFW_THRESHOLD,
    }
```

### 3e. `models/text_nsfw.py`

```python
# moderation-service/models/text_nsfw.py
import re
from detoxify import Detoxify

# Load once at startup
_model = None

# Thresholds per label — tune based on your community standards
THRESHOLDS = {
    "toxicity": 0.80,
    "severe_toxicity": 0.60,
    "obscene": 0.85,
    "threat": 0.70,
    "insult": 0.85,
    "identity_attack": 0.75,
    "sexual_explicit": 0.80,
}


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

    # Detoxify expects plain string
    model = get_model()
    scores: dict = model.predict(text)   # returns {"toxicity": 0.01, "obscene": 0.02, ...}

    flags = []
    for label, threshold in THRESHOLDS.items():
        score = scores.get(label, 0.0)
        if score >= threshold:
            flags.append({
                "label": label,
                "score": round(score, 4),
                "threshold": threshold,
            })

    return flags
```

### 3f. `models/spam.py`

```python
# moderation-service/models/spam.py
import re
from transformers import pipeline

_pipe = None
SPAM_THRESHOLD = 0.90


def get_pipeline():
    global _pipe
    if _pipe is None:
        _pipe = pipeline(
            "text-classification",
            model="mrm8488/bert-tiny-finetuned-sms-spam-detection",
            device=-1,
        )
    return _pipe


# Heuristic rules for blog-specific spam (link farms, SEO spam)
def heuristic_spam_check(text: str) -> list[str]:
    reasons = []

    # Too many external links (more than 10 in a post body = suspicious)
    urls = re.findall(r"https?://\S+", text)
    if len(urls) > 10:
        reasons.append(f"excessive_links:{len(urls)}")

    # Repeated identical phrases (copy-paste spam)
    sentences = [s.strip() for s in re.split(r"[.!?]", text) if len(s.strip()) > 20]
    if len(sentences) != len(set(sentences)) and len(sentences) > 5:
        duplicates = len(sentences) - len(set(sentences))
        if duplicates > 3:
            reasons.append(f"repeated_sentences:{duplicates}")

    # Typical spam phrases
    spam_patterns = [
        r"\bclick here\b", r"\bbuy now\b", r"\bfree money\b",
        r"\bcasino\b", r"\bviagra\b", r"\bweight loss guarantee\b",
        r"\bearn \$\d+", r"\bmake money fast\b",
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
```

### 3g. `main.py`

```python
# moderation-service/main.py
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends
from schemas import (
    PostModerationRequest,
    CommentModerationRequest,
    ModerationResult,
    ModerationFlag,
)
from models.image_nsfw import check_image
from models.text_nsfw import check_text
from models.spam import check_spam

INTERNAL_SECRET = os.getenv("MODERATION_INTERNAL_SECRET", "change-me")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up models at startup so first request isn't slow
    from models.text_nsfw import get_model
    from models.image_nsfw import get_pipeline
    from models.spam import get_pipeline as get_spam_pipeline

    print("Loading text NSFW model...")
    get_model()
    print("Loading image NSFW model...")
    get_pipeline()
    print("Loading spam model...")
    get_spam_pipeline()
    print("All models loaded.")
    yield


app = FastAPI(title="NowBind Moderation Service", lifespan=lifespan)


def verify_secret(x_internal_secret: str = Header(...)):
    """All endpoints are internal-only. Go backend must pass the shared secret."""
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


def decide_action(flags: list[dict]) -> tuple[bool, str]:
    """
    Given a list of triggered flags, decide what to do.
    Returns (safe: bool, action: str)
    """
    if not flags:
        return True, "allow"

    # Hard block labels — always block regardless of score
    hard_block = {"severe_toxicity", "threat", "nsfw_image", "sexual_explicit"}
    for f in flags:
        if f["label"] in hard_block:
            return False, "block"

    # If multiple medium flags → block
    if len(flags) >= 2:
        return False, "block"

    # Single medium flag → flag for human review, allow as draft but not published
    return False, "flag_for_review"


@app.post("/moderate/post", response_model=ModerationResult)
async def moderate_post(
    req: PostModerationRequest,
    _=Depends(verify_secret),
):
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
        labels = [f["label"] for f in all_flags]
        if action == "block":
            message = (
                f"Your post was blocked due to policy violations: {', '.join(labels)}. "
                "Please review our community guidelines."
            )
        else:
            message = (
                f"Your post has been flagged for review: {', '.join(labels)}. "
                "It will remain a draft until a moderator reviews it."
            )

    return ModerationResult(
        safe=safe,
        action=action,
        flags=[ModerationFlag(**f) for f in all_flags],
        message=message,
    )


@app.post("/moderate/comment", response_model=ModerationResult)
async def moderate_comment(
    req: CommentModerationRequest,
    _=Depends(verify_secret),
):
    all_flags = []

    text_nsfw_flags = check_text(req.text)
    all_flags.extend(text_nsfw_flags)

    spam_flags = check_spam(req.text)
    all_flags.extend(spam_flags)

    safe, action = decide_action(all_flags)

    message = None
    if not safe:
        labels = [f["label"] for f in all_flags]
        message = f"Comment blocked due to: {', '.join(labels)}."

    return ModerationResult(
        safe=safe,
        action=action,
        flags=[ModerationFlag(**f) for f in all_flags],
        message=message,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 3h. `Dockerfile`

```dockerfile
# moderation-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system deps for Pillow and httpx
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download models into image so container startup is instant
# (run this as a build step, not at runtime)
RUN python -c "\
from detoxify import Detoxify; Detoxify('unbiased'); \
from transformers import pipeline; \
pipeline('image-classification', model='Falconsai/nsfw_image_detection'); \
pipeline('text-classification', model='mrm8488/bert-tiny-finetuned-sms-spam-detection')"

COPY . .

EXPOSE 8090
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
```

---

## 4. Go Backend Changes

### 4a. New file: `backend/internal/moderation/client.go`

```go
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
```

### 4b. Add moderation client to config and wire it up

**In `backend/internal/config/config.go`**, add these two fields to the `Config` struct:

```go
// Add to existing Config struct:
ModerationServiceURL    string // e.g. "http://moderation-service:8090"
ModerationInternalSecret string
```

Populate them from env (same pattern as other fields):

```go
// In the config loading function:
ModerationServiceURL:     os.Getenv("MODERATION_SERVICE_URL"),
ModerationInternalSecret: os.Getenv("MODERATION_INTERNAL_SECRET"),
```

**In `backend/cmd/server/main.go`**, instantiate and inject the client:

```go
// After creating other services:
var moderationClient *moderation.Client
if cfg.ModerationServiceURL != "" {
    moderationClient = moderation.NewClient(cfg.ModerationServiceURL, cfg.ModerationInternalSecret)
}
```

Pass `moderationClient` into the handler layer (same pattern as other dependencies).

### 4c. Hook into the publish handler

**File: `backend/internal/handler/post_handler.go`** — find `PublishPost` (or equivalent):

```go
// Inside PublishPost handler, BEFORE calling service.PublishPost:

if h.moderationClient != nil {
    // Extract image URLs from post markdown using regex
    imageURLs := extractImageURLs(post.Content)

    result, err := h.moderationClient.ModeratePost(r.Context(), post.ID, post.Content, imageURLs)
    if err != nil {
        // If moderation service is down, log and allow (fail open).
        // Change to "fail closed" (return error) if your policy requires it.
        log.Printf("moderation service unavailable: %v", err)
    } else if !result.Safe {
        if result.Action == "block" {
            http.Error(w, result.Message, http.StatusUnprocessableEntity)
            return
        }
        if result.Action == "flag_for_review" {
            // Don't publish — keep as draft, store moderation flags in DB
            _ = h.service.StoreModerationFlags(r.Context(), post.ID, result.Flags)
            http.Error(w, result.Message, http.StatusUnprocessableEntity)
            return
        }
    }
}
```

Add this helper in the same file:

```go
import "regexp"

var imageURLRegex = regexp.MustCompile(`!\[.*?\]\((https?://[^\s)]+)\)`)

func extractImageURLs(markdown string) []string {
    matches := imageURLRegex.FindAllStringSubmatch(markdown, -1)
    urls := make([]string, 0, len(matches))
    for _, m := range matches {
        if len(m) > 1 {
            urls = append(urls, m[1])
        }
    }
    return urls
}
```

### 4d. Hook into the comment handler

**File: `backend/internal/handler/comment_handler.go`** — find `CreateComment`:

```go
// Inside CreateComment handler, BEFORE persisting the comment:

if h.moderationClient != nil {
    result, err := h.moderationClient.ModerateComment(r.Context(), "", req.Content)
    if err != nil {
        log.Printf("moderation service unavailable: %v", err)
    } else if !result.Safe && result.Action == "block" {
        http.Error(w, result.Message, http.StatusUnprocessableEntity)
        return
    }
}
```

---

## 5. Database Migration

Create `backend/internal/database/migrations/008_moderation.sql`:

```sql
-- 008_moderation.sql
-- Stores moderation flags for posts and comments that were flagged but not hard-blocked.
-- Allows admins to review "flag_for_review" content.

CREATE TABLE IF NOT EXISTS moderation_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('post', 'comment')),
    entity_id   UUID NOT NULL,
    label       TEXT NOT NULL,
    score       NUMERIC(5, 4) NOT NULL,
    threshold   NUMERIC(5, 4) NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('block', 'flag_for_review')),
    reviewed    BOOLEAN NOT NULL DEFAULT FALSE,
    reviewer_id UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_entity ON moderation_flags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_reviewed ON moderation_flags(reviewed) WHERE reviewed = FALSE;

-- Track moderation status on posts table
ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS moderation_status TEXT
        NOT NULL DEFAULT 'clean'
        CHECK (moderation_status IN ('clean', 'flagged', 'blocked'));
```

Add a `StoreModerationFlags` method to the post repository and service (follow existing repository patterns in `backend/internal/repository/`).

---

## 6. Frontend Changes

### 6a. Error handling on publish

In the post editor component (likely `frontend/app/(dashboard)/editor/` or similar), handle the new `422` response from the publish action:

```typescript
// In the publish click handler:
try {
    await publishPost(postId)
    router.push(`/post/${slug}`)
} catch (err: any) {
    if (err.status === 422) {
        // Show moderation rejection reason to the author
        setModerationError(err.message) // display in a toast or alert
    } else {
        setError("Failed to publish. Please try again.")
    }
}
```

### 6b. Moderation error UI

Add a `ModerationAlert` component in `frontend/components/`:

```tsx
// frontend/components/moderation-alert.tsx
"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert } from "lucide-react"

interface ModerationAlertProps {
    message: string
}

export function ModerationAlert({ message }: ModerationAlertProps) {
    return (
        <Alert variant="destructive" className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Content Policy Violation</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    )
}
```

Use `<ModerationAlert message={moderationError} />` in the editor when `moderationError` is set.

### 6c. (Optional) Admin moderation queue page

Add `frontend/app/(dashboard)/admin/moderation/page.tsx` — a table showing all `moderation_flags` with `reviewed = false`, with Approve/Remove buttons. This is a stretch goal; implement after the core service works.

---

## 7. What Happens on Detection

| Scenario | Action | HTTP Status | Author Sees |
|---|---|---|---|
| Post text is clearly NSFW (`sexual_explicit` ≥ 0.80) | **Block** | 422 | "Post blocked: sexual_explicit. See community guidelines." |
| Post text has `threat` ≥ 0.70 | **Block** | 422 | "Post blocked: threat." |
| Post image is NSFW (score ≥ 0.75) | **Block** | 422 | "Post blocked: nsfw_image." |
| Post text is mildly toxic (single flag, medium confidence) | **Flag for review** | 422 | "Post kept as draft pending moderator review." |
| Comment is spam | **Block** | 422 | "Comment blocked: spam." |
| Post body has >10 links (SEO spam heuristic) | **Block** | 422 | "Post blocked: excessive_links." |
| Moderation service is down | **Allow** (fail open) | 200 | Nothing — post publishes normally |
| Post is clean | **Allow** | 200 | Normal publish flow |

### Admin moderator flow (for `flag_for_review`):
1. Post stays in draft state (`published = false`)
2. A `moderation_flags` row is inserted with `action = 'flag_for_review'`
3. Admin sees it in the moderation queue
4. Admin can either approve (publish) or remove the post
5. `moderation_flags.reviewed` is set to `true`, `reviewer_id` set to admin's user ID

---

## 8. Environment Variables

### Backend `.env` additions

```
# Moderation service URL (leave blank to disable moderation)
MODERATION_SERVICE_URL=http://moderation-service:8090

# Shared secret between Go backend and moderation service
MODERATION_INTERNAL_SECRET=generate-a-random-32-char-string-here
```

### Moderation service `.env`

```
MODERATION_INTERNAL_SECRET=same-value-as-above-in-go-backend
```

---

## 9. Docker Compose Update

Add to `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  moderation-service:
    build:
      context: ./moderation-service
      dockerfile: Dockerfile
    container_name: nowbind-moderation
    restart: unless-stopped
    environment:
      - MODERATION_INTERNAL_SECRET=${MODERATION_INTERNAL_SECRET}
    ports:
      - "8090:8090"   # expose for local debugging; remove in production
    # Uncomment below if you have a CUDA GPU:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]
    networks:
      - nowbind-net

  backend:
    # ... existing backend config ...
    environment:
      # ... existing env vars ...
      - MODERATION_SERVICE_URL=http://moderation-service:8090
      - MODERATION_INTERNAL_SECRET=${MODERATION_INTERNAL_SECRET}
    depends_on:
      - moderation-service
```

---

## 10. Testing Checklist

### Unit tests for `moderation-service`

```python
# moderation-service/test_main.py
from fastapi.testclient import TestClient
from main import app
import os
os.environ["MODERATION_INTERNAL_SECRET"] = "test-secret"

client = TestClient(app)
HEADERS = {"X-Internal-Secret": "test-secret"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200


def test_clean_post():
    r = client.post("/moderate/post", json={
        "post_id": "abc",
        "text": "This is a great tutorial on Golang concurrency patterns.",
        "image_urls": []
    }, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["safe"] is True
    assert r.json()["action"] == "allow"


def test_nsfw_text():
    r = client.post("/moderate/post", json={
        "post_id": "abc",
        "text": "Buy cheap Viagra now! Click here for free money casino!!!",
        "image_urls": []
    }, headers=HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data["safe"] is False


def test_missing_secret():
    r = client.post("/moderate/post", json={
        "post_id": "abc",
        "text": "hello",
        "image_urls": []
    })
    assert r.status_code == 422  # missing header


def test_wrong_secret():
    r = client.post("/moderate/post", json={
        "post_id": "abc",
        "text": "hello",
        "image_urls": []
    }, headers={"X-Internal-Secret": "wrong"})
    assert r.status_code == 403
```

Run with: `pytest moderation-service/test_main.py -v`

### Go integration test (manual)

1. Start moderation-service: `cd moderation-service && uvicorn main:app --port 8090`
2. Start Go backend with `MODERATION_SERVICE_URL=http://localhost:8090`
3. Create a post with clearly NSFW text via the editor
4. Click Publish — should get a 422 with a message instead of publishing
5. Create a clean post → should publish normally
6. Check `moderation_flags` table in Postgres for flagged content

### PR checklist additions (add to `CONTRIBUTING.md`)

```markdown
- [ ] If touching post publish or comment create flows, verify moderation service
      is running locally and test with both clean and flagged content
- [ ] Do not log raw flagged content at INFO level — use DEBUG or omit entirely
- [ ] Moderation thresholds live in `moderation-service/models/*.py` — changes
      there need justification in the PR description
```

---

## Summary: Files to Create / Modify

| File | Action |
|---|---|
| `moderation-service/main.py` | **Create** |
| `moderation-service/schemas.py` | **Create** |
| `moderation-service/models/image_nsfw.py` | **Create** |
| `moderation-service/models/text_nsfw.py` | **Create** |
| `moderation-service/models/spam.py` | **Create** |
| `moderation-service/requirements.txt` | **Create** |
| `moderation-service/Dockerfile` | **Create** |
| `moderation-service/test_main.py` | **Create** |
| `backend/internal/moderation/client.go` | **Create** |
| `backend/internal/config/config.go` | **Modify** — add 2 fields |
| `backend/cmd/server/main.go` | **Modify** — instantiate client |
| `backend/internal/handler/post_handler.go` | **Modify** — add moderation call in PublishPost |
| `backend/internal/handler/comment_handler.go` | **Modify** — add moderation call in CreateComment |
| `backend/internal/repository/` | **Modify** — add StoreModerationFlags |
| `backend/internal/service/` | **Modify** — add StoreModerationFlags |
| `backend/internal/database/migrations/008_moderation.sql` | **Create** |
| `frontend/components/moderation-alert.tsx` | **Create** |
| `frontend/app/(dashboard)/editor/` | **Modify** — handle 422 moderation errors |
| `docker-compose.yml` | **Modify** — add moderation-service |
| `.env.example` (backend) | **Modify** — document new vars |
| `CONTRIBUTING.md` | **Modify** — add PR checklist items |