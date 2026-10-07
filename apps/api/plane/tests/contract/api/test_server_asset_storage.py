# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os
from unittest.mock import patch

import pytest
from rest_framework import status

from plane.db.models import FileAsset

INTERNAL = "http://seaweedfs-s3.storage:8333"
PUBLIC = "http://testserver"
MINIO_ENV = {
    "USE_MINIO": "1",
    "MINIO_ENDPOINT_SSL": "0",
    "AWS_S3_ENDPOINT_URL": INTERNAL,
    "AWS_ACCESS_KEY_ID": "key",
    "AWS_SECRET_ACCESS_KEY": "secret",
    "AWS_S3_BUCKET_NAME": "uploads",
    "AWS_REGION": "us-east-1",
}


@pytest.mark.contract
@pytest.mark.django_db
@patch.dict(os.environ, MINIO_ENV)
class TestServerAssetEndpoints:
    """The server asset endpoints sign against the request host."""

    def test_user_server_asset_upload(self, api_key_client):
        response = api_key_client.post(
            "/api/v1/assets/user-assets/server/",
            {"name": "avatar.png", "type": "image/png", "size": 100, "entity_type": "USER_AVATAR"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["upload_data"]["url"].startswith(PUBLIC)

    def test_generic_asset_upload(self, api_key_client, workspace):
        response = api_key_client.post(
            f"/api/v1/workspaces/{workspace.slug}/assets/",
            {"name": "doc.pdf", "type": "application/pdf", "size": 100},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["upload_data"]["url"].startswith(PUBLIC)

    def test_generic_asset_download(self, api_key_client, workspace, create_user):
        asset = FileAsset.objects.create(
            attributes={"name": "doc.pdf", "type": "application/pdf", "size": 10},
            asset=f"{workspace.id}/doc.pdf",
            size=10,
            workspace=workspace,
            created_by=create_user,
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            is_uploaded=True,
            storage_metadata={"size": 10},
        )

        response = api_key_client.get(f"/api/v1/workspaces/{workspace.slug}/assets/{asset.id}/")

        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["asset_url"].startswith(f"{PUBLIC}/uploads/{workspace.id}/doc.pdf")
