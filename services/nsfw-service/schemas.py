# moderation-service/schemas.py
from pydantic import BaseModel, HttpUrl
from typing import Optional


class TextModerationRequest(BaseModel):
    text: str  # full post body (markdown stripped) or comment


class ImageModerationRequest(BaseModel):
    image_url: HttpUrl  # publicly accessible URL of the image


class ModerationFlag(BaseModel):
    model_config = {"extra": "ignore"}
    label: str  # e.g. "nsfw_image", "sexual_explicit", "spam", "explicit_keywords"
    score: float  # confidence 0.0 – 1.0
    threshold: float  # threshold that was applied


class ModerationResult(BaseModel):
    safe: bool  # False = block content
    action: str  # "allow" | "block" | "flag_for_review"
    flags: list[ModerationFlag]  # what triggered, empty if safe
    message: Optional[str] = None  # human-readable reason (shown to author)


class PostModerationRequest(BaseModel):
    post_id: str
    text: str  # full markdown body, will be stripped
    image_urls: list[HttpUrl] = []  # all images found in the post


class CommentModerationRequest(BaseModel):
    comment_id: str
    text: str
