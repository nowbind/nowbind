# services/Dockerfile — unified ML services image
FROM python:3.11-slim

WORKDIR /app

# System deps for Pillow / httpx
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download all ML models so container startup is instant.
RUN python -c "\
from detoxify import Detoxify; Detoxify('unbiased'); \
from transformers import pipeline; \
pipeline('image-classification', model='Falconsai/nsfw_image_detection'); \
pipeline('text-classification', model='mrm8488/bert-tiny-finetuned-sms-spam-detection'); \
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('all-MiniLM-L6-v2')"

# Copy all service code into /app (the run cwd)
COPY . /app

EXPOSE 8090
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
