FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Tesseract with the Japanese language packs (jpn-vert covers vertical writing).
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-jpn \
      tesseract-ocr-jpn-vert \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /code

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 9004

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9004", "--reload"]
