# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""S3 client construction for the export tasks against a custom endpoint."""

import io
from unittest.mock import MagicMock, patch

import pytest

from plane.bgtasks.export_task import upload_to_s3
from plane.bgtasks.exporter_expired_task import delete_old_s3_link

pytestmark = pytest.mark.unit

ENDPOINT = "http://seaweedfs-s3.storage.svc:8333"


@patch("plane.bgtasks.exporter_expired_task.ExporterHistory")
class TestDeleteOldS3Link:
    @pytest.mark.parametrize("use_minio", [True, False])
    @patch("plane.bgtasks.exporter_expired_task.boto3.client")
    def test_endpoint_url_is_always_passed(self, mock_client, _history, use_minio, settings):
        settings.USE_MINIO = use_minio
        settings.AWS_S3_ENDPOINT_URL = ENDPOINT
        settings.AWS_REGION = "us-east-1"

        delete_old_s3_link()

        assert mock_client.call_args.kwargs["endpoint_url"] == ENDPOINT

    @patch("plane.bgtasks.exporter_expired_task.boto3.client")
    def test_empty_endpoint_becomes_none(self, mock_client, _history, settings):
        settings.USE_MINIO = False
        settings.AWS_S3_ENDPOINT_URL = ""
        settings.AWS_REGION = ""

        delete_old_s3_link()

        assert mock_client.call_args.kwargs["endpoint_url"] is None
        assert mock_client.call_args.kwargs["region_name"] is None


@patch("plane.bgtasks.export_task.ExporterHistory")
class TestUploadToS3PresignBase:
    @pytest.mark.parametrize("bucket", ["uploads", "assets"])
    @patch("plane.bgtasks.export_task.boto3.client")
    def test_presign_endpoint_strips_the_configured_bucket(self, mock_client, _history, bucket, settings):
        settings.USE_MINIO = True
        settings.AWS_S3_ENDPOINT_URL = ENDPOINT
        settings.AWS_STORAGE_BUCKET_NAME = bucket
        settings.AWS_S3_CUSTOM_DOMAIN = f"plane.example.com/{bucket}"
        settings.AWS_S3_URL_PROTOCOL = "https:"
        mock_client.return_value = MagicMock()

        upload_to_s3(io.BytesIO(b"zip"), "00000000-0000-0000-0000-000000000000", "token1", "slug")

        presign_kwargs = mock_client.call_args_list[-1].kwargs
        assert presign_kwargs["endpoint_url"] == "https://plane.example.com/"
