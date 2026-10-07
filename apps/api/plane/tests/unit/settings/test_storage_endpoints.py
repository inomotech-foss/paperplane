# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os
from unittest.mock import patch

import pytest
from django.test import RequestFactory

from plane.settings.storage import S3Storage

INTERNAL = "http://seaweedfs-s3.storage:8333"
MINIO_ENV = {
    "USE_MINIO": "1",
    "MINIO_ENDPOINT_SSL": "0",
    "AWS_S3_ENDPOINT_URL": INTERNAL,
    "AWS_ACCESS_KEY_ID": "key",
    "AWS_SECRET_ACCESS_KEY": "secret",
    "AWS_S3_BUCKET_NAME": "uploads",
    "AWS_REGION": "us-east-1",
}


@pytest.fixture
def public_request():
    return RequestFactory().get("/", HTTP_HOST="plane.example.com", secure=True)


@pytest.mark.unit
class TestS3StorageEndpoints:
    @patch.dict(os.environ, MINIO_ENV, clear=True)
    def test_presign_uses_request_host_and_ops_use_internal_endpoint(self, public_request):
        storage = S3Storage(request=public_request)

        assert storage.generate_presigned_url("a.png").startswith("https://plane.example.com/uploads/a.png")
        assert storage.generate_presigned_post("a.png", "image/png", 10)["url"].startswith("https://plane.example.com/")
        assert storage.ops_client.meta.endpoint_url == INTERNAL

    @patch.dict(os.environ, MINIO_ENV, clear=True)
    def test_server_operations_go_to_internal_endpoint(self, public_request):
        storage = S3Storage(request=public_request)
        with (
            patch.object(storage.ops_client, "head_object", return_value={}) as head,
            patch.object(storage.ops_client, "get_object", return_value={}) as get,
            patch.object(storage.ops_client, "copy_object", return_value={}) as copy,
            patch.object(storage.ops_client, "upload_fileobj") as upload,
            patch.object(storage.ops_client, "delete_objects") as delete,
            patch.object(storage.s3_client, "_make_api_call") as public_call,
        ):
            storage.get_object_metadata("a.png")
            storage.get_object("a.png")
            storage.copy_object("a.png", "b.png")
            storage.upload_file(b"x", "a.png")
            storage.delete_files(["a.png"])

        for method in (head, get, copy, upload, delete):
            method.assert_called_once()
        public_call.assert_not_called()

    @patch.dict(os.environ, MINIO_ENV, clear=True)
    def test_upload_does_not_leak_content_type_between_calls(self):
        storage = S3Storage()
        with patch.object(storage.ops_client, "upload_fileobj") as upload:
            storage.upload_file(b"x", "a.png", content_type="image/png")
            storage.upload_file(b"x", "b.bin")

        assert upload.call_args_list[1].kwargs["ExtraArgs"] == {}

    @patch.dict(os.environ, {**MINIO_ENV, "AWS_S3_ENDPOINT_URL": ""}, clear=True)
    def test_without_internal_endpoint_ops_fall_back_to_request_host(self, public_request):
        storage = S3Storage(request=public_request)

        assert storage.ops_client is storage.s3_client
        assert storage.ops_client.meta.endpoint_url == "https://plane.example.com"

    @patch.dict(os.environ, MINIO_ENV, clear=True)
    def test_without_request_one_client_uses_internal_endpoint(self):
        storage = S3Storage()

        assert storage.ops_client is storage.s3_client
        assert storage.s3_client.meta.endpoint_url == INTERNAL

    @patch.dict(os.environ, MINIO_ENV, clear=True)
    def test_clients_fail_fast(self, public_request):
        config = S3Storage(request=public_request).ops_client.meta.config

        assert config.connect_timeout == 5
        assert config.retries["total_max_attempts"] == 2
