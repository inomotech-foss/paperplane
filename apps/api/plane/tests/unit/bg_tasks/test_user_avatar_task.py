# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import hashlib
import uuid
from unittest.mock import patch

import pytest

from plane.bgtasks import user_avatar_task
from plane.bgtasks.user_avatar_task import sync_user_avatar
from plane.db.models import Account, FileAsset, User

GRAPH_URL = "https://graph.microsoft.com/v1.0/me/photo/$value"
CONTENT = b"image-bytes"


def _user(**fields):
    return User.objects.create(email=f"{uuid.uuid4().hex}@plane.so", username=uuid.uuid4().hex, **fields)


def _asset(user, source_hash):
    asset = FileAsset.objects.create(
        attributes={"source_hash": source_hash},
        asset=f"{uuid.uuid4().hex}.png",
        size=1,
        user=user,
        created_by=user,
        entity_type=FileAsset.EntityTypeContext.USER_AVATAR,
        is_uploaded=True,
    )
    user.avatar_asset = asset
    user.save()
    return asset


@pytest.fixture
def storage():
    with patch.object(user_avatar_task, "S3Storage") as storage_cls:
        storage_cls.return_value.upload_file.return_value = True
        storage_cls.return_value.get_object_metadata.return_value = {}
        yield storage_cls.return_value


def _fetch(result):
    return patch.object(user_avatar_task, "fetch_avatar_bytes", return_value=result)


@pytest.mark.unit
@pytest.mark.django_db
class TestSyncUserAvatar:
    def test_new_avatar_replaces_old_asset(self, storage):
        user = _user()
        old = _asset(user, "old-hash")

        with _fetch((CONTENT, "image/png", "png")):
            sync_user_avatar(str(user.id), "oidc", GRAPH_URL)

        user.refresh_from_db()
        assert user.avatar_asset_id != old.id
        assert user.avatar_asset.attributes["source_hash"] == hashlib.sha256(CONTENT).hexdigest()
        storage.upload_file.assert_called_once()
        storage.delete_files.assert_called_once_with(object_names=[old.asset.name])

    def test_unchanged_avatar_is_not_reuploaded(self, storage):
        user = _user()
        current = _asset(user, hashlib.sha256(CONTENT).hexdigest())

        with _fetch((CONTENT, "image/png", "png")):
            sync_user_avatar(str(user.id), "oidc", GRAPH_URL)

        user.refresh_from_db()
        assert user.avatar_asset_id == current.id
        storage.upload_file.assert_not_called()
        storage.delete_files.assert_not_called()

    def test_failed_fetch_keeps_existing_avatar(self, storage):
        user = _user()
        current = _asset(user, "old-hash")

        with _fetch(None):
            sync_user_avatar(str(user.id), "oidc", GRAPH_URL, fallback_url="https://cdn/new.png")

        user.refresh_from_db()
        assert user.avatar_asset_id == current.id
        assert user.avatar == ""
        storage.delete_files.assert_not_called()

    def test_failed_upload_keeps_existing_avatar(self, storage):
        user = _user()
        current = _asset(user, "old-hash")
        storage.upload_file.return_value = False

        with _fetch((CONTENT, "image/png", "png")):
            sync_user_avatar(str(user.id), "google", "https://cdn/pic.png")

        user.refresh_from_db()
        assert user.avatar_asset_id == current.id
        storage.delete_files.assert_not_called()

    def test_failed_fetch_sets_fallback_when_user_has_no_avatar(self, storage):
        user = _user()

        with _fetch(None):
            sync_user_avatar(str(user.id), "google", "https://cdn/pic.png", fallback_url="https://cdn/pic.png")

        user.refresh_from_db()
        assert user.avatar == "https://cdn/pic.png"

    def test_graph_fetch_uses_account_token(self, storage):
        user = _user()
        Account.objects.create(user=user, provider="oidc", provider_account_id="sub", access_token="graph-token")

        with _fetch(None) as fetch:
            sync_user_avatar(str(user.id), "oidc", GRAPH_URL)

        fetch.assert_called_once_with(GRAPH_URL, {"Authorization": "Bearer graph-token"})

    @pytest.mark.parametrize("provider, url", [("oidc", "https://cdn.example.com/pic.png"), ("google", GRAPH_URL)])
    def test_token_is_not_sent_elsewhere(self, storage, provider, url):
        user = _user()
        Account.objects.create(user=user, provider=provider, provider_account_id="sub", access_token="secret")

        with _fetch(None) as fetch:
            sync_user_avatar(str(user.id), provider, url)

        fetch.assert_called_once_with(url, {})
