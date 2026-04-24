# moderation-service/test_main.py
from fastapi.testclient import TestClient
import os

os.environ["MODERATION_INTERNAL_SECRET"] = "test-secret"

from main import app  # noqa: E402 (must set env before import)

client = TestClient(app)
HEADERS = {"X-Internal-Secret": "test-secret"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


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


def test_clean_comment():
    r = client.post("/moderate/comment", json={
        "comment_id": "abc",
        "text": "Great article, thanks for sharing!"
    }, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["safe"] is True


def test_missing_secret():
    r = client.post("/moderate/post", json={
        "post_id": "abc",
        "text": "hello",
        "image_urls": []
    })
    assert r.status_code == 403  # missing header returns forbidden


def test_wrong_secret():
    r = client.post("/moderate/post", json={
        "post_id": "abc",
        "text": "hello",
        "image_urls": []
    }, headers={"X-Internal-Secret": "wrong"})
    assert r.status_code == 403
