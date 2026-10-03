"""Run with:  python -m unittest   (from this folder; no AWS account or network needed)"""

import io
import json
import os
import unittest
from unittest import mock

import handler


class FakeS3:
    def __init__(self, objects):
        self.objects = objects

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[Key])}


def s3_event(key):
    return {"Records": [{"s3": {"bucket": {"name": "docs"}, "object": {"key": key}}}]}


class ExtractTextTest(unittest.TestCase):
    def test_plain_text(self):
        self.assertEqual(handler.extract_text("héllo".encode("utf-8"), "notes.txt"), "héllo")

    def test_unsupported_type(self):
        with self.assertRaises(ValueError):
            handler.extract_text(b"x", "archive.zip")


class HandlerTest(unittest.TestCase):
    def setUp(self):
        os.environ["DOCUMENT_SERVICE_URL"] = "http://documents.internal"
        os.environ["INTERNAL_API_KEY"] = "test-key"

    def run_handler(self, key, objects):
        sent = []

        def fake_urlopen(request, timeout):
            sent.append((request, json.loads(request.data)))
            return mock.MagicMock(__enter__=lambda s: mock.Mock(status=200), __exit__=lambda *a: False)

        with mock.patch("urllib.request.urlopen", fake_urlopen):
            result = handler.handler(s3_event(key), None, s3_client=FakeS3(objects))
        return result, sent

    def test_posts_extracted_text_with_decoded_key(self):
        result, sent = self.run_handler("tenant/abc/my+notes.txt", {"tenant/abc/my notes.txt": b"some text"})
        request, body = sent[0]
        self.assertEqual(result, {"processed": 1})
        self.assertEqual(request.full_url, "http://documents.internal/internal/documents/extracted")
        self.assertEqual(request.get_header("X-internal-key"), "test-key")
        self.assertEqual(body, {"storageKey": "tenant/abc/my notes.txt", "text": "some text", "error": None})

    def test_reports_failure_instead_of_raising(self):
        _, sent = self.run_handler("tenant/abc/file.zip", {"tenant/abc/file.zip": b"PK"})
        self.assertIsNone(sent[0][1]["text"])
        self.assertIn("ValueError", sent[0][1]["error"])


if __name__ == "__main__":
    unittest.main()
