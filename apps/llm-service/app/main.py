from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os, re, json

app = FastAPI(title='LLM Extraction Service')

class Payload(BaseModel):
    text: str

def mock_extract(text: str):
    invoice = re.search(r'(?im)^\\s*invoice\\s*(?:no\\.?|number|#)\\s*[:#-]?\\s*([A-Z0-9-]+)', text)
    total = re.search(r'(?im)^\\s*total\\b\\s*[:₹$]?\\s*([0-9,]+(?:\\.\\d{1,2})?)', text)
    return {
        'provider': 'mock',
        'documentType': 'invoice' if 'invoice' in text.lower() else 'generic',
        'invoiceNumber': invoice.group(1) if invoice else None,
        'total': float(total.group(1).replace(',', '')) if total else None,
        'summary': text[:240],
    }

def openai_extract(text: str):
    from openai import OpenAI
    client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])
    schema = {
        'type': 'object',
        'properties': {
            'documentType': {'type': 'string'},
            'invoiceNumber': {'type': ['string', 'null']},
            'vendor': {'type': ['string', 'null']},
            'invoiceDate': {'type': ['string', 'null']},
            'currency': {'type': ['string', 'null']},
            'subtotal': {'type': ['number', 'null']},
            'tax': {'type': ['number', 'null']},
            'total': {'type': ['number', 'null']},
            'summary': {'type': 'string'},
        },
        'required': ['documentType','invoiceNumber','vendor','invoiceDate','currency','subtotal','tax','total','summary'],
        'additionalProperties': False,
    }
    response = client.responses.create(
        model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
        input=[
            {'role':'system','content':'Extract business-document fields. Never invent values not present in OCR text.'},
            {'role':'user','content':text[:20000]},
        ],
        text={'format': {'type':'json_schema','name':'document_extraction','strict':True,'schema':schema}},
    )
    data = json.loads(response.output_text)
    data['provider'] = 'openai'
    return data

@app.get('/health')
def health():
    return {'status':'ok', 'provider':'openai' if os.getenv('OPENAI_API_KEY') else 'mock'}

@app.post('/extract')
def extract(payload: Payload):
    if not payload.text.strip():
        raise HTTPException(400, 'text is required')
    if os.getenv('OPENAI_API_KEY'):
        try:
            return openai_extract(payload.text)
        except Exception as exc:
            raise HTTPException(502, f'LLM provider failed: {exc}')
    return mock_extract(payload.text)
