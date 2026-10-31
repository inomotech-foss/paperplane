# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The JSON auth endpoints document the bodies they read."""

import jsonschema
import pytest

from plane.tests.openapi import documented_request

EMAIL_ROUTES = [
    "/auth/email-check/",
    "/auth/spaces/email-check/",
    "/auth/magic-generate/",
    "/auth/spaces/magic-generate/",
    "/auth/forgot-password/",
    "/auth/spaces/forgot-password/",
]


@pytest.mark.contract
@pytest.mark.parametrize("route", EMAIL_ROUTES)
def test_email_bodies(route):
    documented_request(route, "post", {"email": "ann@plane.so"})
    with pytest.raises(jsonschema.ValidationError):
        documented_request(route, "post", {})


@pytest.mark.contract
def test_set_password_body():
    documented_request("/auth/set-password/", "post", {"password": "a-long-password-1"})
