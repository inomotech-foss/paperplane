# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the shared auth Adapter signup mapping."""

from unittest.mock import patch

import pytest
from django.test import RequestFactory

from plane.authentication.adapter.base import Adapter


class _FakeAdapter(Adapter):
    """Minimal adapter that returns pre-baked user data, like an OAuth provider."""

    def __init__(self, request, provider, user_data, persistable_avatar=None):
        super().__init__(request=request, provider=provider)
        self.user_data = user_data
        self.token_data = None  # skip account creation
        self._persistable_avatar = persistable_avatar

    def get_persistable_avatar_url(self, avatar_url):
        if self._persistable_avatar is not None:
            return self._persistable_avatar
        return super().get_persistable_avatar_url(avatar_url)


@pytest.fixture
def request_obj():
    return RequestFactory().get("/", HTTP_USER_AGENT="pytest")


@pytest.mark.contract
class TestAdapterSignupMapping:
    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_display_name_from_provider_is_persisted(self, _email, request_obj):
        adapter = _FakeAdapter(
            request_obj,
            provider="oidc",
            user_data={
                "email": "first.last@plane.so",
                "user": {
                    "provider_id": "sub-1",
                    "email": "first.last@plane.so",
                    "first_name": "First",
                    "last_name": "Last",
                    "display_name": "First Last",
                    "avatar": "",
                    "is_password_autoset": True,
                },
            },
        )
        user = adapter.complete_login_or_signup()
        user.refresh_from_db()
        assert user.first_name == "First"
        assert user.last_name == "Last"
        # Not the email local part ("first.last").
        assert user.display_name == "First Last"

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_missing_display_name_falls_back_to_email_local_part(self, _email, request_obj):
        adapter = _FakeAdapter(
            request_obj,
            provider="oidc",
            user_data={
                "email": "someone@plane.so",
                "user": {
                    "provider_id": "sub-2",
                    "email": "someone@plane.so",
                    "first_name": "Some",
                    "last_name": "One",
                    "avatar": "",
                    "is_password_autoset": True,
                },
            },
        )
        user = adapter.complete_login_or_signup()
        user.refresh_from_db()
        assert user.display_name == "someone"

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.sync_user_avatar")
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_signup_stores_persistable_avatar_and_enqueues_download(
        self, _email, task, request_obj, django_capture_on_commit_callbacks
    ):
        adapter = _FakeAdapter(
            request_obj,
            provider="oidc",
            user_data={
                "email": "graph@plane.so",
                "user": {
                    "provider_id": "sub-3",
                    "email": "graph@plane.so",
                    "first_name": "Graph",
                    "last_name": "User",
                    "avatar": "https://graph.microsoft.com/v1.0/me/photo/$value",
                    "is_password_autoset": True,
                },
            },
            persistable_avatar="",  # provider drops token-gated URLs
        )
        with django_capture_on_commit_callbacks(execute=True):
            user = adapter.complete_login_or_signup()
        user.refresh_from_db()
        assert user.avatar == ""
        assert user.avatar_asset is None
        task.delay.assert_called_once_with(str(user.id), "oidc", "https://graph.microsoft.com/v1.0/me/photo/$value", "")
