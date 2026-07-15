"""Regression tests. Each one exists because the bug it guards actually shipped."""

import io

import pytesseract
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app import config
from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    # The context manager form runs the lifespan handler, so the Tesseract
    # startup check is exercised too.
    with TestClient(app) as c:
        yield c


def _png_bytes(text: str = "", size: tuple[int, int] = (400, 120)) -> bytes:
    image = Image.new("RGB", size, "white")
    if text:
        ImageDraw.Draw(image).text((20, 40), text, fill="black")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_health_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_japanese_langpack_installed() -> None:
    """The original code picked langs[0] from a sorted list, which is always
    'eng' -- so this Japanese app silently ran English OCR. If the jpn pack
    ever falls out of the image again, this fails immediately."""
    installed = set(pytesseract.get_languages())
    assert {"jpn", "eng"} <= installed, f"installed languages: {sorted(installed)}"


def test_configured_lang_is_japanese_capable() -> None:
    assert "jpn" in config.OCR_LANG.split("+")


def test_convert_rejects_non_image(client: TestClient) -> None:
    """Used to be a 500 from deep inside PIL; any file at all was written to
    disk and handed to Image.open."""
    response = client.post(
        "/convert/", files={"file": ("notes.pdf", b"%PDF-1.4 not an image", "application/pdf")}
    )
    assert response.status_code == 415


def test_convert_rejects_truncated_image(client: TestClient) -> None:
    """A valid header with a chopped body passes Image.open() and only fails at
    load(), raising a bare OSError -- which used to escape as a 500."""
    truncated = _png_bytes("HELLO")[:300]
    response = client.post("/convert/", files={"file": ("broken.png", truncated, "image/png")})
    assert response.status_code == 415


def test_convert_rejects_oversized_upload(client: TestClient) -> None:
    oversized = b"\x89PNG\r\n\x1a\n" + b"0" * (config.MAX_UPLOAD_BYTES + 1)
    response = client.post("/convert/", files={"file": ("big.png", oversized, "image/png")})
    assert response.status_code == 413


def test_convert_reads_text(client: TestClient) -> None:
    """Exercises the whole pipeline including the Tesseract binary itself.

    Latin text only: rendering Japanese would need a CJK font in the image
    (~50MB+), and test_japanese_langpack_installed already guards the jpn risk
    far more cheaply.
    """
    response = client.post(
        "/convert/", files={"file": ("sample.png", _png_bytes("HELLO"), "image/png")}
    )
    assert response.status_code == 200
    assert "HELLO" in response.json()["text"].upper()
