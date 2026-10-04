# AI Document Intelligence Platform

A Docker-first, Kubernetes-ready document processing platform that turns invoice and receipt **images or PDFs** into structured JSON using OCR + LLM extraction.

## Problem

Business teams often receive invoices, receipts, purchase documents, and scanned forms that require manual data entry. This project demonstrates how to convert those unstructured documents into structured data through an asynchronous microservice pipeline.

## Architecture

```text
                         +----------------+
                         |     Browser    |
                         +-------+--------+
                                 |
                                 v
                         +----------------+
                         |    Frontend    |
                         |     Nginx      |
                         +-------+--------+
                                 |
                                 v
                         +----------------+
                         |      API       |
                         | Node.js/Express|
                         +---+--------+---+
                             |        |
                    metadata|        |enqueue
                             v        v
                      +------+--+  +--+-------+
                      |PostgreSQL|  | Redis /  |
                      +------^--+  | BullMQ   |
                             |     +----+-----+
                             |          |
                             |          v
                             |     +----+-----+
                             |     |  Worker  |
                             |     +----+-----+
                             |          |
                         +---+----------+---+
                         |                  |
                         v                  v
                   +-----------+      +-----------+
                   |    OCR    |----->|    LLM    |
                   | Tesseract | text | Extraction|
                   +-----------+      +-----------+
```

## What it demonstrates

- Node.js API and background worker
- BullMQ/Redis asynchronous processing
- PostgreSQL lifecycle and result storage
- Python/FastAPI OCR microservice
- Tesseract OCR for images and PDFs
- LLM-based schema extraction with a deterministic local fallback
- Docker and Docker Compose
- Kubernetes Deployments, Services, ConfigMaps, Secrets and PVCs
- Readiness/liveness probes
- CPU/memory requests and limits
- Horizontal Pod Autoscaling
- Ingress
- GitHub Actions CI

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`.

API health check:

```bash
curl http://localhost:3000/health
```

## API

```text
POST /documents          multipart form field: file
GET  /documents
GET  /documents/:id
```

Example upload:

```bash
curl -F "file=@/path/to/invoice.png" http://localhost:3000/documents
```

The upload responds immediately with a queued document:

```json
{
  "id": "<uuid>",
  "status": "queued"
}
```

The worker then moves it through:

```text
queued -> processing -> completed
                       \-> failed
```

Example extraction:

```json
{
  "provider": "mock",
  "documentType": "invoice",
  "invoiceNumber": "INV-42",
  "total": 1250.5,
  "summary": "Invoice INV-42 Total 1,250.50"
}
```

## LLM integration

Without an API key, the extraction service uses a deterministic local extractor, which keeps the entire project runnable for free.

To enable the OpenAI provider, set:

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=your_model
```

The provider is required to return schema-constrained JSON and is instructed not to invent values missing from OCR text.

## Kubernetes

Starter manifests live in `kubernetes/`.

```bash
kubectl apply -k kubernetes/
```

The example ingress uses:

```text
aidoc.local
```

and expects an NGINX ingress controller.

> The sample upload PVC requests `ReadWriteMany`. On EKS, use an RWX-capable storage class such as EFS. A production evolution would replace the shared upload volume with S3/object storage.

## Repository structure

```text
apps/
  api/
  worker/
  ocr-service/
  llm-service/
  frontend/
kubernetes/
docs/
samples/
.github/workflows/
docker-compose.yml
```

## Tests and CI

CI runs:

- Node API/worker tests
- Python OCR/LLM tests
- `docker compose config`
- Docker builds for the full stack

## Next improvements

- S3/MinIO object storage
- Authentication and per-user isolation
- Prometheus/Grafana/OpenTelemetry
- KEDA worker scaling based on queue depth
- Dead-letter queue and replay tooling
- Helm chart and dev/staging overlays
