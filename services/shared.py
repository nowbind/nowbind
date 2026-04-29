"""Shared configuration and dependencies for all ML services."""

import os
from pathlib import Path
from typing import Optional

from fastapi import Header, HTTPException


# Load .env file if present (for local development)
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _, _value = _line.partition("=")
            os.environ.setdefault(_key.strip(), _value.strip())


INTERNAL_SECRET = os.getenv("MODERATION_INTERNAL_SECRET", "")


def validate_secret():
    """Refuse to start if the internal secret is unset."""
    if not INTERNAL_SECRET:
        raise RuntimeError(
            "MODERATION_INTERNAL_SECRET is unset. "
            "Set a strong random secret (32+ chars) before starting the service."
        )


def verify_secret(x_internal_secret: Optional[str] = Header(default=None)):
    """All endpoints are internal-only. Go backend must pass the shared secret."""
    if not x_internal_secret or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
