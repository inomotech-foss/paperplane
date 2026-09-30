# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for resolving OAuth logins through the linked provider account."""

import uuid
from unittest.mock import patch

import pytest
from django.test import RequestFactory

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.authentication.adapter.oauth import OauthAdapter
from plane.db.models import Account, Profile, User


class _FakeOauthAdapter(OauthAdapter):
    """OAuth adapter that returns pre-baked token and user data."""

    def __init__(self, request, provider, email, sub):
        super().__init__(
            request=request,
            provider=provider,
            client_id="client",
            scope="openid",
            redirect_uri="http://testserver/callback/",
            auth_url="http://idp/authorize",
            token_url="http://idp/token",
            userinfo_url=None,
        )
        self.token_data = {"access_token": "token", "id_token": ""}
        self.user_data = {
            "email": email,
            "user": {
                "provider_id": sub,
                "email": email,
                "first_name": "",
                "last_name": "",
                "display_name": "",
                "avatar": "",
                "is_password_autoset": True,
            },
        }

    def check_sync_enabled(self):
        return False


@pytest.fixture
def request_obj():
    return RequestFactory().get("/", HTTP_USER_AGENT="pytest")


def _make_user(email):
    user = User.objects.create(email=email, username=uuid.uuid4().hex)
    Profile.objects.create(user=user)
    return user


def _link(user, provider, sub):
    Account.objects.create(user=user, provider=provider, provider_account_id=sub, access_token="old")


@pytest.mark.contract
class TestOauthAccountLink:
    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_changed_email_logs_into_linked_user(self, _email, request_obj):
        user = _make_user("old@plane.so")
        _link(user, "oidc", "sub-1")

        result = _FakeOauthAdapter(request_obj, "oidc", "new@plane.so", "sub-1").complete_login_or_signup()

        assert result.pk == user.pk
        user.refresh_from_db()
        assert user.email == "new@plane.so"
        assert User.objects.count() == 1

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_changed_email_taken_by_another_user_is_rejected(self, _email, request_obj):
        user = _make_user("old@plane.so")
        _link(user, "oidc", "sub-1")
        _make_user("new@plane.so")

        with pytest.raises(AuthenticationException) as exc:
            _FakeOauthAdapter(request_obj, "oidc", "new@plane.so", "sub-1").complete_login_or_signup()

        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["USER_ALREADY_EXIST"]
        user.refresh_from_db()
        assert user.email == "old@plane.so"

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_unlinked_user_is_matched_by_email_and_linked(self, _email, request_obj):
        user = _make_user("someone@plane.so")

        result = _FakeOauthAdapter(request_obj, "oidc", "someone@plane.so", "sub-2").complete_login_or_signup()

        assert result.pk == user.pk
        assert Account.objects.filter(user=user, provider="oidc", provider_account_id="sub-2").exists()

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_link_is_scoped_to_provider(self, _email, request_obj):
        user = _make_user("old@plane.so")
        _link(user, "gitea", "sub-1")

        result = _FakeOauthAdapter(request_obj, "oidc", "new@plane.so", "sub-1").complete_login_or_signup()

        assert result.pk != user.pk
        user.refresh_from_db()
        assert user.email == "old@plane.so"
