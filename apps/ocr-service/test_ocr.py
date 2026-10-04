from fastapi.testclient import TestClient
from app import main

client = TestClient(main.app)


def test_health():
    assert client.get('/health').json() == {'status': 'ok'}


def test_image_ocr_route(monkeypatch):
    monkeypatch.setattr(main, 'ocr_image', lambda data: 'Invoice No: IMG-1\nTotal: 99.90')
    r = client.post('/ocr', content=b'not-a-real-image')
    assert r.status_code == 200
    body = r.json()
    assert body['format'] == 'image'
    assert 'IMG-1' in body['text']


def test_pdf_ocr_route(monkeypatch):
    monkeypatch.setattr(main, 'ocr_pdf', lambda data: 'Invoice No: PDF-1\nTotal: 10.00')
    r = client.post('/ocr', content=b'%PDF-fake')
    assert r.status_code == 200
    body = r.json()
    assert body['format'] == 'pdf'
    assert 'PDF-1' in body['text']


def test_empty_document_rejected():
    r = client.post('/ocr', content=b'')
    assert r.status_code == 400
