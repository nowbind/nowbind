# services/nsfw-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system deps for Pillow and httpx
RUN apt-get update && apt-get install -y \
    libgl1 \
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

COPY nsfw-service /app/nsfw-service

# Set working dir to the specific service so imports work seamlessly
WORKDIR /app/nsfw-service

EXPOSE 8090
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
