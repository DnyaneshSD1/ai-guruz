# AI Guruz — Lambdas

Python functions used only in the AWS deployment. Nothing here is needed to run the platform locally.

## document-extractor

Moves document text extraction out of the document service so large uploads do not load its instances.

```
upload ──> document-service ──> S3 bucket ──(ObjectCreated)──> document-extractor (Python)
                 ^                                                     │
                 └──── POST /internal/documents/extracted ─────────────┘
                        {storageKey, text | error}   header X-Internal-Key
```

- Locally the document service extracts text itself (`EXTRACTION_MODE=inline`, Apache Tika).
- In production set `STORAGE_MODE=s3`, `STORAGE_S3_BUCKET=<bucket>` and `EXTRACTION_MODE=lambda` on the document
  service. The document stays `PROCESSING` until the Lambda calls back.
- Supported here: PDF, DOCX, PPTX, TXT, MD, HTML, RTF. On failure the Lambda reports the error so the document is
  marked `FAILED` instead of staying in progress.

| File | Purpose |
|---|---|
| `handler.py` | The function |
| `requirements.txt` | Dependencies packaged with it |
| `template.yaml` | AWS SAM template: bucket, function, S3 trigger, VPC access |
| `test_handler.py` | Unit tests (no AWS account or network needed) |

### Test

```bash
cd document-extractor
python -m unittest
```

### Deploy

```bash
cd document-extractor
sam build
sam deploy --guided      # asks for the bucket name, the document service's internal URL, the internal key, subnets
```

The function runs inside the VPC so it can reach the document service's internal address; give it a route to S3
(a gateway VPC endpoint is the simplest).

This function has been unit-tested but not deployed from this workspace.
