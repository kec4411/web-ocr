"""Runtime configuration, read from environment variables."""

import os

# Tesseract language(s). Japanese documents routinely embed Latin text
# (numbers, product codes, URLs) which `jpn` alone reads poorly, so the
# default combines both. Pure-Japanese input may score slightly better
# with `jpn` alone -- hence configurable rather than hardcoded.
OCR_LANG: str = os.getenv("OCR_LANG", "jpn+eng")

# Page segmentation mode. 3 = automatic page segmentation, Tesseract's own
# default. The original code hardcoded 6 ("assume a single uniform block of
# text"), which is frequently wrong for arbitrary user uploads.
OCR_PSM: str = os.getenv("OCR_PSM", "3")

MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))

CORS_ALLOW_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/gif", "image/bmp", "image/tiff", "image/webp"}
)
