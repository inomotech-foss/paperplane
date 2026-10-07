# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for refreshing profile data from the provider on login."""

import uuid
from unittest.mock import patch

import pytest
from django.test import RequestFactory

from plane.authentication.adapter.base import Adapter
from plane.authentication.adapter.oauth import OauthAdapter
from plane.bgtasks.user_avatar_task import sync_user_avatar
from plane.db.models import Account, FileAsset, Profile, User


class _FakeAdapter(Adapter):
    """Adapter that returns pre-baked user data, like an OAuth provider."""

    def __init__(self, request, provider, user_data):
        super().__init__(request=request, provider=provider)
        self.user_data = user_data
        self.token_data = None  # skip account creation

    def get_persistable_avatar_url(self, avatar_url):
        return ""


class _FakeOauthAdapter(OauthAdapter):
    """OAuth adapter with pre-baked user data that saves a real Account."""

    def __init__(self, request, provider, user_data):
        super().__init__(
            request=request,
            provider=provider,
            client_id="client",
            scope="openid",
            redirect_uri="https://plane.example.com/callback",
            auth_url="https://idp.example.com/authorize",
            token_url="https://idp.example.com/token",
            userinfo_url="https://idp.example.com/userinfo",
        )
        self.user_data = user_data


@pytest.fixture
def request_obj():
    return RequestFactory().get("/", HTTP_USER_AGENT="pytest")


def _make_user(email):
    user = User.objects.create(email=email, username=uuid.uuid4().hex)
    Profile.objects.create(user=user)
    return user


def _user_data(email, **user_fields):
    user = {
        "provider_id": "sub",
        "email": email,
        "first_name": "",
        "last_name": "",
        "display_name": "",
        "avatar": "",
        "is_password_autoset": True,
    }
    user.update(user_fields)
    return {"email": email, "user": user}


def _avatar_asset(user, source_hash, asset_name):
    return FileAsset.objects.create(
        attributes={"source_hash": source_hash},
        asset=asset_name,
        size=1,
        user=user,
        created_by=user,
        entity_type=FileAsset.EntityTypeContext.USER_AVATAR,
        is_uploaded=True,
    )


@pytest.mark.contract
class TestLoginProfileRefresh:
    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_oidc_login_refreshes_name_and_display_by_default(self, _email, request_obj):
        user = _make_user("returning@plane.so")
        user.first_name, user.last_name, user.display_name = "Old", "Name", "Old Name"
        user.save()

        adapter = _FakeAdapter(
            request_obj,
            provider="oidc",
            user_data=_user_data("returning@plane.so", first_name="New", last_name="Name", display_name="New Name"),
        )
        result = adapter.complete_login_or_signup()
        result.refresh_from_db()
        assert (result.first_name, result.last_name, result.display_name) == ("New", "Name", "New Name")

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_non_oidc_login_does_not_sync_by_default(self, _email, request_obj):
        user = _make_user("google@plane.so")
        user.first_name = "Old"
        user.save()

        adapter = _FakeAdapter(
            request_obj, provider="google", user_data=_user_data("google@plane.so", first_name="New")
        )
        result = adapter.complete_login_or_signup()
        result.refresh_from_db()
        assert result.first_name == "Old"


@pytest.mark.contract
class TestLoginAvatarRefresh:
    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_login_enqueues_avatar_sync_instead_of_fetching(
        self, _email, request_obj, django_capture_on_commit_callbacks
    ):
        user = _make_user("avatar@plane.so")
        asset = _avatar_asset(user, "hash", "existing-avatar.png")
        user.avatar_asset = asset
        user.save()

        adapter = _FakeAdapter(
            request_obj, provider="oidc", user_data=_user_data("avatar@plane.so", avatar="https://idp/pic")
        )
        with (
            patch("plane.authentication.adapter.base.sync_user_avatar") as task,
            patch("plane.bgtasks.user_avatar_task.fetch_avatar_bytes") as fetch,
            django_capture_on_commit_callbacks(execute=True),
        ):
            result = adapter.complete_login_or_signup()

        fetch.assert_not_called()
        task.delay.assert_called_once_with(str(user.id), "oidc", "https://idp/pic", "")
        result.refresh_from_db()
        assert result.avatar_asset_id == asset.id

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_login_without_provider_avatar_keeps_existing(
        self, _email, request_obj, django_capture_on_commit_callbacks
    ):
        user = _make_user("noavatar@plane.so")
        asset = _avatar_asset(user, "hash", "uploaded-avatar.png")
        user.avatar_asset = asset
        user.save()

        adapter = _FakeAdapter(request_obj, provider="oidc", user_data=_user_data("noavatar@plane.so"))
        with (
            patch("plane.authentication.adapter.base.sync_user_avatar") as task,
            django_capture_on_commit_callbacks(execute=True),
        ):
            result = adapter.complete_login_or_signup()

        task.delay.assert_not_called()
        result.refresh_from_db()
        assert result.avatar_asset_id == asset.id

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_avatar_task_reads_token_saved_by_login(self, _email, request_obj):
        user = _make_user("graph@plane.so")
        graph_url = "https://graph.microsoft.com/v1.0/me/photo/$value"
        adapter = _FakeOauthAdapter(
            request_obj, provider="oidc", user_data=_user_data("graph@plane.so", avatar=graph_url)
        )
        adapter.token_data = {"access_token": "fresh-token"}

        with (
            patch("plane.authentication.adapter.base.sync_user_avatar") as task,
            patch("plane.bgtasks.user_avatar_task.fetch_avatar_bytes", return_value=None) as fetch,
            # Outside a transaction on_commit runs at once, so the enqueue must follow the account save.
            patch("plane.authentication.adapter.base.transaction.on_commit", side_effect=lambda fn, robust: fn()),
        ):
            task.delay.side_effect = sync_user_avatar
            adapter.complete_login_or_signup()

        assert Account.objects.filter(user=user, provider="oidc").exists()
        fetch.assert_called_once_with(graph_url, {"Authorization": "Bearer fresh-token"})
