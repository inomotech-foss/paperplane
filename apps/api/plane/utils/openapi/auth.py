# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
OpenAPI authentication extensions for drf-spectacular.

This module provides authentication extensions that automatically register
custom authentication classes with the OpenAPI schema generator.
"""

from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension

from .hooks import ADMIN_PATH_PREFIX

DEFAULT_SESSION_COOKIE_NAME = "session-id"


class APIKeyAuthenticationExtension(OpenApiAuthenticationExtension):
    """
    OpenAPI authentication extension for
    plane.api.middleware.api_authentication.APIKeyAuthentication
    """

    target_class = "plane.api.middleware.api_authentication.APIKeyAuthentication"
    name = "ApiKeyAuthentication"
    priority = 1

    def get_security_definition(self, auto_schema):
        """
        Return the security definition for API key authentication.
        """
        return {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API key authentication. Provide your API key in the X-API-Key header.",  # noqa: E501
        }


class DefaultSessionAuthenticationExtension(OpenApiAuthenticationExtension):
    """The built-in cookieAuth, with the default cookie name instead of the deployment's."""

    target_class = "rest_framework.authentication.SessionAuthentication"
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": DEFAULT_SESSION_COOKIE_NAME}


class SessionAuthenticationExtension(OpenApiAuthenticationExtension):
    """Session cookie without CSRF enforcement, unlike the built-in cookieAuth."""

    target_class = "plane.authentication.session.BaseSessionAuthentication"
    name = "sessionAuth"

    def get_security_definition(self, auto_schema):
        # Mirrors plane.authentication.middleware.session. The default name keeps the schema
        # independent of the deployment's SESSION_COOKIE_NAME.
        is_admin = auto_schema.path.startswith(ADMIN_PATH_PREFIX)
        cookie_name = settings.ADMIN_SESSION_COOKIE_NAME if is_admin else DEFAULT_SESSION_COOKIE_NAME
        return {"type": "apiKey", "in": "cookie", "name": cookie_name}


class OAuthBearerAuthenticationExtension(OpenApiAuthenticationExtension):
    target_class = "plane.api.middleware.oauth_authentication.OAuthBearerAuthentication"
    name = "oauthBearer"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer"}
