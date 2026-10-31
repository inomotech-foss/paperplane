# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the user file asset lookup."""

import pytest
from rest_framework import status

from plane.db.models import FileAsset


@pytest.mark.contract
@pytest.mark.django_db
class TestUserFileAssetLookup:
    def test_returns_the_users_asset(self, session_client, create_user):
        asset = FileAsset(attributes={"name": "a.png"}, asset="avatar-a.png", size=1)
        asset.save(created_by_id=create_user.id)

        response = session_client.get("/api/users/file-assets/avatar-a.png/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] is True
        assert [str(item["id"]) for item in response.data["data"]] == [str(asset.id)]

    def test_unknown_key(self, session_client):
        response = session_client.get("/api/users/file-assets/missing.png/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] is False
