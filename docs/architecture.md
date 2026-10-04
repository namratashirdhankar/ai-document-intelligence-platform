# Architecture decisions

## Processing model

The API accepts a document, persists its metadata, queues work, and immediately returns HTTP 202. OCR and model extraction happen asynchronously so expensive processing never blocks the upload request.

```text
Browser
  |
  v
Frontend (Nginx)
  |
  v
API -----> PostgreSQL
  |
  v
Redis / BullMQ
  |
  v
Worker ---> OCR Service ---> LLM Extraction Service
  |                               |
  +------------> PostgreSQL <-----+
```

## Why separate OCR and LLM services?

They have different dependencies and scaling characteristics. OCR is CPU-heavy and contains native Tesseract packages, while LLM extraction is network/model-bound. Kubernetes can scale, resource-limit, upgrade, and observe them independently.

## Queue and retry strategy

BullMQ decouples ingestion from processing. Jobs use three attempts with exponential backoff. Lifecycle state is stored as `queued`, `processing`, `completed`, or `failed` in PostgreSQL.

## Storage

The Docker Compose version uses a named shared upload volume. The Kubernetes example uses an RWX PVC so both API and worker can access uploaded files. On AWS/EKS, EFS is a natural match. For a production architecture, object storage such as S3 is preferable because it removes shared-filesystem coupling.

## LLM mode

The extraction service has two modes:

- **Local fallback**: deterministic regex extraction so the project runs without paid APIs.
- **OpenAI provider**: enabled when `OPENAI_API_KEY` is set and constrained to a JSON schema.

This keeps the demo reproducible while preserving a real provider integration path.

## Kubernetes concepts demonstrated

- Deployments and Services
- ConfigMaps and Secrets
- PersistentVolumeClaims
- Liveness/readiness probes
- CPU/memory requests and limits
- HorizontalPodAutoscaler
- Ingress
- Independent service scaling
