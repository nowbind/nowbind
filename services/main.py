"""NowBind ML Services — unified entrypoint.

Run locally (from services/ directory):
    uvicorn main:app --host 0.0.0.0 --port 8090

All sub-services (nsfw, autotag, etc.) are mounted on this single
FastAPI instance and share port 8090.
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from shared import INTERNAL_SECRET, verify_secret
from nsfw_service.main import lifespan as nsfw_lifespan
from nsfw_service.main import router as nsfw_router
from autotag_service.router import router as autotag_router
from autotag_service.router import warmup_autotag


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Boot all ML models at startup."""
    async with nsfw_lifespan(app):
        warmup_autotag()
        # Log secret prefix for debugging auth issues (never log full secret)
        masked = INTERNAL_SECRET[:4] + "****" if len(INTERNAL_SECRET) > 4 else "****"
        print(f"Internal secret configured: {masked}")
        yield


app = FastAPI(title="NowBind ML Services", lifespan=lifespan)

# NSFW / spam moderation endpoints
app.include_router(nsfw_router, dependencies=[Depends(verify_secret)])

# Auto-tag suggestion endpoints
app.include_router(autotag_router, dependencies=[Depends(verify_secret)])
