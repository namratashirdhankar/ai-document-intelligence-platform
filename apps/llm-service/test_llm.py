from fastapi.testclient import TestClient
from app.main import app

def test_extract_invoice():
    r = TestClient(app).post('/extract', json={'text':'Invoice INV-42 Total 1,250.50'})
    assert r.status_code == 200
    body = r.json()
    assert body['documentType'] == 'invoice'
    assert body['invoiceNumber'] == 'INV-42'
    assert body['total'] == 1250.5
