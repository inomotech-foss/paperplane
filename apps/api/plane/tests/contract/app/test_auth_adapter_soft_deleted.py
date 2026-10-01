# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""A soft-deleted user cannot be resurrected by logging in."""

from unittest.mock import patch

import pytest
from django.test import RequestFactory

from plane.authentication.adapter.base import Adapter
from plane.authentication.adapter.error import AuthenticationException
from plane.db.models import User
from plane.license.utils.user_lifecycle import soft_delete_user


class _FakeAdapter(Adapter):
    def __init__(self, request, user_data):
        super().__init__(request=request, provider="oidc")
        self.user_data = user_data
        self.token_data = None


def user_data(email):
    return {
        "email": email,
        "user": {"provider_id": "sub", "email": email, "first_name": "A", "last_name": "B", "avatar": ""},
    }


@pytest.mark.contract
class TestSoftDeletedLogin:
    @pytest.mark.django_db
    def test_deleted_user_is_rejected_even_when_matched_by_id(self, db):
        user = User.objects.create(email="gone@plane.so", username="gone")
        soft_delete_user(user)
        request = RequestFactory().get("/", HTTP_USER_AGENT="pytest")
        adapter = _FakeAdapter(request, user_data(user.email))

        with pytest.raises(AuthenticationException) as excinfo:
            adapter.complete_login_or_signup()

        assert excinfo.value.error_message == "USER_ACCOUNT_DEACTIVATED"
        user.refresh_from_db()
        assert user.is_active is False

    @pytest.mark.django_db
    @patch("plane.authentication.adapter.base.user_activation_email")
    def test_the_old_email_becomes_a_fresh_account(self, _email, db):
        user = User.objects.create(email="gone@plane.so", username="gone")
        soft_delete_user(user)
        request = RequestFactory().get("/", HTTP_USER_AGENT="pytest")
        adapter = _FakeAdapter(request, user_data("gone@plane.so"))
        adapter.user_data["user"]["is_password_autoset"] = True

        fresh = adapter.complete_login_or_signup()

        assert fresh.pk != user.pk
        assert fresh.email == "gone@plane.so"
