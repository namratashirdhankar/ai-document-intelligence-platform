from fastapi import FastAPI, Request, HTTPException
from PIL import Image
import io
import pytesseract
import pypdfium2 as pdfium

app = FastAPI(title="OCR Service")


@app.get("/health")
def health():
    return {"status": "ok"}


def ocr_image(data: bytes) -> str:
    image = Image.open(io.BytesIO(data)).convert("RGB")
    return pytesseract.image_to_string(image).strip()


def ocr_pdf(data: bytes) -> str:
    pdf = pdfium.PdfDocument(data)
    pages: list[str] = []
    try:
        for page_number in range(len(pdf)):
            page = pdf[page_number]
            bitmap = page.render(scale=2)
            image = bitmap.to_pil().convert("RGB")
            text = pytesseract.image_to_string(image).strip()
            pages.append(text)
            page.close()
    finally:
        pdf.close()
    return "\n\n".join(filter(None, pages))


@app.post("/ocr")
async def ocr(request: Request):
    data = await request.body()
    if not data:
        raise HTTPException(400, "empty file")

    try:
        if data.startswith(b"%PDF"):
            text = ocr_pdf(data)
            document_format = "pdf"
        else:
            text = ocr_image(data)
            document_format = "image"

        return {"text": text, "format": document_format}
    except Exception as exc:
        raise HTTPException(422, f"unsupported or unreadable document: {exc}") from exc
