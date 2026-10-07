# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging
import os
import uuid

from django.core.exceptions import ValidationError
from django.core.validators import validate_email

# Django imports
from django.db import transaction
from django.utils import timezone

# Third party imports
from zxcvbn import zxcvbn

from plane.bgtasks.user_activation_email_task import user_activation_email
from plane.bgtasks.user_avatar_task import sync_user_avatar

# Module imports
from plane.db.models import Profile, User, WorkspaceMemberInvite
from plane.license.utils.instance_value import get_configuration_value
from plane.utils.exception_logger import log_exception
from plane.utils.host import base_host
from plane.utils.ip_address import get_client_ip

from .error import AUTHENTICATION_ERROR_CODES, AuthenticationException


class Adapter:
    """Common interface for all auth providers"""

    def __init__(self, request, provider, callback=None):
        self.request = request
        self.provider = provider
        self.callback = callback
        self.token_data = None
        self.user_data = None
        self.logger = logging.getLogger("plane.authentication")

    def get_user_token(self, data, headers=None):
        raise NotImplementedError

    def get_user_response(self):
        raise NotImplementedError

    def set_token_data(self, data):
        self.token_data = data

    def set_user_data(self, data):
        self.user_data = data

    def create_update_account(self, user):
        raise NotImplementedError

    def get_linked_user(self):
        return None

    def authenticate(self):
        raise NotImplementedError

    def sanitize_email(self, email):
        # Check if email is present
        if not email:
            self.logger.error("Email is not present")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_EMAIL"],
                error_message="INVALID_EMAIL",
                payload={"email": email},
            )

        # Sanitize email
        email = str(email).lower().strip()

        # validate email
        try:
            validate_email(email)
        except ValidationError:
            self.logger.warning("Email is not valid")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_EMAIL"],
                error_message="INVALID_EMAIL",
                payload={"email": email},
            )
        # Return email
        return email

    def validate_password(self, email):
        """Validate password strength"""
        results = zxcvbn(self.code)
        if results["score"] < 3:
            self.logger.warning("Password is not strong enough")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["PASSWORD_TOO_WEAK"],
                error_message="PASSWORD_TOO_WEAK",
                payload={"email": email},
            )
        return

    def __check_signup(self, email):
        """Check if sign up is enabled or not and raise exception if not enabled"""

        # OIDC provisioning has its own toggle, independent of manual signup.
        key = "ENABLE_OIDC_SIGNUP" if self.provider == "oidc" else "ENABLE_SIGNUP"
        (enabled,) = get_configuration_value([{"key": key, "default": os.environ.get(key, "1")}])

        # Invited users may be created regardless.
        if enabled == "0" and not WorkspaceMemberInvite.objects.filter(email=email).exists():
            self.logger.warning("Sign up is disabled and invite is not present")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["SIGNUP_DISABLED"],
                error_message="SIGNUP_DISABLED",
                payload={"email": email},
            )

        return True

    def get_persistable_avatar_url(self, avatar_url):
        """URL to store in the plain ``avatar`` field; providers can drop ones the browser can't load."""
        return avatar_url or ""

    def check_sync_enabled(self):
        """Check if sync is enabled for the provider"""
        provider_config_map = {
            "google": "ENABLE_GOOGLE_SYNC",
            "github": "ENABLE_GITHUB_SYNC",
            "gitlab": "ENABLE_GITLAB_SYNC",
            "gitea": "ENABLE_GITEA_SYNC",
            "oidc": "ENABLE_OIDC_SYNC",
        }
        config_key = provider_config_map.get(self.provider)
        if config_key:
            # OIDC is the source of truth, so it refreshes by default; others are opt-in.
            default = "1" if self.provider == "oidc" else "0"
            (enabled,) = get_configuration_value([{"key": config_key, "default": os.environ.get(config_key, default)}])
            return enabled == "1"
        return False

    def save_user_data(self, user):
        # Update user details
        user.last_login_medium = self.provider
        user.last_active = timezone.now()
        user.last_login_time = timezone.now()
        user.last_login_ip = get_client_ip(request=self.request)
        user.last_login_uagent = self.request.META.get("HTTP_USER_AGENT")
        user.token_updated_at = timezone.now()
        # Activate provisioned accounts that have never been deactivated.
        # Explicitly-deactivated accounts are rejected earlier in
        # complete_login_or_signup() before this method is ever reached.
        # Save first so activation is persisted before the email side-effect fires.
        was_inactive = not user.is_active
        user.is_active = True
        user.save()
        if was_inactive:
            try:
                user_activation_email.delay(base_host(request=self.request), user.id)
            except Exception as e:
                log_exception(e)
        return user

    def sync_user_data(self, user):
        first_name = self.user_data.get("user", {}).get("first_name", "")
        last_name = self.user_data.get("user", {}).get("last_name", "")
        user.first_name = first_name if first_name else ""
        user.last_name = last_name if last_name else ""

        email = self.user_data.get("email")

        # Fall back to a derived display name when the provider omits one.
        display_name = self.user_data.get("user", {}).get("display_name")
        if not display_name:
            display_name = User.get_display_name(email)
        user.display_name = display_name

        user.save()
        return user

    def enqueue_avatar_sync(self, user):
        avatar = self.user_data.get("user", {}).get("avatar", "")
        if not avatar:
            return
        fallback_url = self.get_persistable_avatar_url(avatar)
        transaction.on_commit(
            lambda: sync_user_avatar.delay(str(user.id), self.provider, avatar, fallback_url),
            robust=True,
        )

    def __change_email(self, user, email):
        if User.objects.filter(email=email).exclude(pk=user.pk).exists():
            self.logger.warning(
                "Provider email is already used by another user",
                extra={"user_id": str(user.id), "provider": self.provider},
            )
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OAUTH_EMAIL_CONFLICT"],
                error_message="OAUTH_EMAIL_CONFLICT",
                payload={"email": email, "provider": self.provider},
            )
        user.email = email
        user.save(update_fields=["email"])

    def complete_login_or_signup(self):
        # Get email
        email = self.user_data.get("email")

        # Sanitize email
        email = self.sanitize_email(email)

        # A user already linked to this provider identity wins over an email match,
        # so a changed address at the provider does not create a second account.
        user = self.get_linked_user() or User.objects.filter(email=email).first()

        # Reject explicitly-deactivated accounts (GHSA-rmmf-rj2q-3rrg).
        # The deactivation endpoint always sets last_logout_time, so using it
        # as the discriminator is more reliable than last_login_time: a
        # provisioned account that was never deactivated has last_logout_time=None
        # and is allowed through for its first login; an account deactivated via
        # the API has last_logout_time set and is blocked regardless of whether
        # it had previously logged in.
        if user and (user.deleted_at or (not user.is_active and user.last_logout_time is not None)):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["USER_ACCOUNT_DEACTIVATED"],
                error_message="USER_ACCOUNT_DEACTIVATED",
                payload={"email": email},
            )

        # Reject bot service accounts (BOT_USER_LOGIN_FORBIDDEN). Bots (is_bot=True,
        # e.g. the WORKSPACE_SEED bot) are internal identities that act only through
        # API tokens; they must never be assumable via the interactive login/signup
        # flow (email/password, magic code, or any OAuth provider). A brand-new
        # signup can never be a bot — bots are provisioned internally, never through
        # this path — so guarding on an existing `user` record is sufficient.
        if user and user.is_bot:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["BOT_USER_LOGIN_FORBIDDEN"],
                error_message="BOT_USER_LOGIN_FORBIDDEN",
                payload={"email": email},
            )

        if user and user.email != email:
            self.__change_email(user, email)

        # True = new user (signup), False = returning user (login)
        is_signup = not bool(user)
        # If user is not present, create a new user
        if not user:
            # New user
            self.__check_signup(email)

            # Initialize user
            user = User(email=email, username=uuid.uuid4().hex)

            # Check if password is autoset
            if self.user_data.get("user").get("is_password_autoset"):
                user.set_password(uuid.uuid4().hex)
                user.is_password_autoset = True
                user.is_email_verified = True

            # Validate password
            else:
                # Validate password
                self.validate_password(email)
                # Set password
                user.set_password(self.code)
                user.is_password_autoset = False

            # Set user details
            first_name = self.user_data.get("user", {}).get("first_name", "")
            last_name = self.user_data.get("user", {}).get("last_name", "")
            user.first_name = first_name if first_name else ""
            user.last_name = last_name if last_name else ""

            # Without this, User.save() defaults display_name to the email local part.
            display_name = self.user_data.get("user", {}).get("display_name")
            if display_name:
                user.display_name = display_name

            user.save()

            avatar = self.user_data.get("user", {}).get("avatar", "")
            if avatar:
                user.avatar = self.get_persistable_avatar_url(avatar)

            # Create profile
            Profile.objects.create(user=user)

        # Check if IDP sync is enabled and user is not signing up
        sync_enabled = not is_signup and self.check_sync_enabled()
        if sync_enabled:
            user = self.sync_user_data(user=user)

        # Save user data
        user = self.save_user_data(user=user)

        # Call callback if present
        if self.callback:
            self.callback(user, is_signup, self.request)

        # Create or update account if token data is present
        if self.token_data:
            self.create_update_account(user=user)

        # After the account save: the task reads the provider token from it.
        if is_signup or sync_enabled:
            self.enqueue_avatar_sync(user=user)

        # Return user
        return user
