"""Document text extraction Lambda (production only).

Triggered by S3 ObjectCreated events on the documents bucket. Extracts plain text from the uploaded
file and posts it to the document service, which stores it and marks the document READY.

Locally this Lambda is not used: the document service extracts text in-process (EXTRACTION_MODE=inline).

Environment:
  DOCUMENT_SERVICE_URL  base URL of the document service, reachable from the Lambda (inside the VPC)
  INTERNAL_API_KEY      shared key for the service's /internal endpoints
"""

from __future__ import annotations

import io
import json
import logging
import os
import urllib.parse
import urllib.request

log = logging.getLogger()
log.setLevel(logging.INFO)

# Mirrors DocumentService.MAX_TEXT_CHARS in the Java service.
MAX_TEXT_CHARS = 2_000_000


def extract_text(data: bytes, filename: str) -> str:
    """Returns the plain text of a document, chosen by file extension."""
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    if extension == "docx":
        from docx import Document

        document = Document(io.BytesIO(data))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    if extension == "pptx":
        from pptx import Presentation

        presentation = Presentation(io.BytesIO(data))
        lines = []
        for slide in presentation.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    lines.append(shape.text_frame.text)
        return "\n".join(lines)
    if extension in ("txt", "md", "html", "rtf"):
        return data.decode("utf-8", errors="replace")
    raise ValueError(f"Unsupported file type: .{extension}")


def post_result(storage_key: str, text: str | None, error: str | None) -> None:
    body = json.dumps({"storageKey": storage_key, "text": text, "error": error}).encode("utf-8")
    request = urllib.request.Request(
        os.environ["DOCUMENT_SERVICE_URL"].rstrip("/") + "/internal/documents/extracted",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "X-Internal-Key": os.environ["INTERNAL_API_KEY"]},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        log.info("Callback for %s returned %s", storage_key, response.status)


def handler(event, context, s3_client=None):
    if s3_client is None:
        import boto3

        s3_client = boto3.client("s3")

    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        # S3 event keys are URL-encoded (spaces arrive as '+').
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        try:
            data = s3_client.get_object(Bucket=bucket, Key=key)["Body"].read()
            text = extract_text(data, key)[:MAX_TEXT_CHARS]
            post_result(key, text, None)
        except Exception as exc:  # report the failure so the document does not stay PROCESSING forever
            log.exception("Extraction failed for %s", key)
            post_result(key, None, f"Text extraction failed: {type(exc).__name__}")
    return {"processed": len(event.get("Records", []))}
