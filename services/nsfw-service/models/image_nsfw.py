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


NSFW_THRESHOLD = 0.50  # lower = stricter; 0.50 catches most explicit content


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
