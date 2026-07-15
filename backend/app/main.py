"""Web OCR backend: accepts an image upload and returns the recognised text."""

import io
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from starlette.middleware.cors import CORSMiddleware

from . import config

logger = logging.getLogger(__name__)


def _verify_tesseract() -> None:
    """Fail fast if Tesseract or a configured language pack is missing.

    A missing language pack means the container is broken, so it must surface
    at boot rather than on a user's first upload -- the original code silently
    fell back to whichever language sorted first.
    """
    version = pytesseract.get_tesseract_version()
    installed = set(pytesseract.get_languages())
    required = set(config.OCR_LANG.split("+"))
    missing = required - installed
    if missing:
        raise RuntimeError(
            f"Tesseract {version} is missing language pack(s): {sorted(missing)}. "
            f"Installed: {sorted(installed)}"
        )
    logger.info("Tesseract %s ready, languages=%s", version, config.OCR_LANG)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _verify_tesseract()
    yield


app = FastAPI(title="Web OCR", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ALLOW_ORIGINS,
    # Browsers reject `Access-Control-Allow-Origin: *` when credentials are on,
    # and this API sends no cookies, so credentials stay off.
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/convert/")
async def convert(file: UploadFile = File(...)) -> dict[str, str]:
    if file.content_type not in config.ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"対応していないファイル形式です: {file.content_type or 'unknown'}",
        )

    contents = await file.read()
    if len(contents) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"ファイルが大きすぎます (上限 {config.MAX_UPLOAD_BYTES // 1024 // 1024}MB)",
        )

    try:
        image = Image.open(io.BytesIO(contents))
        # Decode eagerly: a valid header with a truncated body only fails here.
        image.load()
    except Image.DecompressionBombError:
        raise HTTPException(status_code=413, detail="画像の解像度が大きすぎます。")
    except (UnidentifiedImageError, OSError) as exc:
        # UnidentifiedImageError subclasses OSError; a truncated image raises
        # a bare OSError. Both mean "not a usable image", not a server fault.
        logger.info("Rejected undecodable upload: %s", exc)
        raise HTTPException(status_code=415, detail="画像として読み取れませんでした。")

    try:
        text = pytesseract.image_to_string(
            image, lang=config.OCR_LANG, config=f"--psm {config.OCR_PSM}"
        )
    except pytesseract.TesseractError as exc:
        logger.exception("Tesseract failed")
        raise HTTPException(status_code=500, detail=f"OCR に失敗しました: {exc}")

    # Log the size, never the content -- this is a user's document.
    logger.debug("OCR produced %d characters", len(text))
    return {"text": text}
