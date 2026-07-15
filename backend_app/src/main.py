from fastapi import FastAPI, File, UploadFile, File, HTTPException, Response
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware
import cv2
import shutil
from pathlib import Path
from tempfile import NamedTemporaryFile
# OCR
from PIL import Image
import pyocr
import pyocr.builders

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class TestParam(BaseModel):
    param1 : str
    param2 : str

@app.get("/")
def get_root():
    return {"message": "fastapi sample"}

@app.post("/uploadfile/")
async def create_upload_file(file: UploadFile = File(...)):
    return {"filename": file.filename}

@app.post("/convert/")
def convert(file: UploadFile = File(...)):
    filepath = save_upload_file_tmp(file)
    if filepath.suffix == ".jpg" or filepath.suffix == ".jpeg":
        try:
            png_path = jpg_to_png(filepath)
        except Exception as e:
            raise HTTPException(status_code=500, detail='Failed to convert an image.')
        finally:
            filepath.unlink()
    else:
        png_path = filepath

    try:
        txt = ocr_read(str(png_path))
        # return Response(content=img_enc.tostring(), media_type='image/png')
    except Exception as e:
        raise HTTPException(status_code=500, detail='Failed to ocr read.')
    finally:
        png_path.unlink()

    return {"ocrresult": txt}

def save_upload_file_tmp(upload_file: UploadFile) -> Path:
    try:
        suffix = Path(upload_file.filename).suffix
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(upload_file.file, tmp)
        tmp_path = Path(tmp.name)
    finally:
        upload_file.file.close()
    return tmp_path

def jpg_to_png(jpg) -> Path:
    img = cv2.imread(str(jpg))
    png = create_temppath(".png")
    cv2.imwrite(png, img, [int(cv2.IMWRITE_PNG_COMPRESSION ), 1])
    png_path = Path(png)
    return png_path

def ocr_read(png_path):
    tools = pyocr.get_available_tools()
    tool = tools[0]
    langs = tool.get_available_languages()
    lang = langs[0]
    img = Image.open(png_path)
    txt = tool.image_to_string(
        img,
        lang = lang,
        builder = pyocr.builders.TextBuilder(tesseract_layout=6)
    )
    print(txt)
    return txt

def create_temppath(extname: str) -> str:
    temppath = ""
    with NamedTemporaryFile(suffix=extname) as tmp:
        temppath = tmp.name
    return temppath