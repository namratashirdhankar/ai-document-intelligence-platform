from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_extract_invoice_uses_grand_total_not_subtotal():
    text = """INVOICE

Invoice No: INV-42
Vendor: Example Technologies Pvt Ltd
Subtotal: 1000.00
Tax: 250.50
Total: 1250.50
"""
    r = client.post('/extract', json={'text': text})
    assert r.status_code == 200
    body = r.json()
    assert body['documentType'] == 'invoice'
    assert body['invoiceNumber'] == 'INV-42'
    assert body['total'] == 1250.50
    assert body['provider'] == 'mock'


def test_extract_generic_document():
    r = client.post('/extract', json={'text': 'Meeting notes for project kickoff'})
    assert r.status_code == 200
    body = r.json()
    assert body['documentType'] == 'generic'
    assert body['invoiceNumber'] is None
    assert body['total'] is None


def test_extract_rejects_empty_text():
    r = client.post('/extract', json={'text': '   '})
    assert r.status_code == 400


def test_health_reports_provider():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'
    assert r.json()['provider'] in {'mock', 'openai'}
