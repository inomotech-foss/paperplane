# SPDX-License-Identifier: AGPL-3.0-only

import pytest
from django.test import RequestFactory

from plane.utils.ip_address import get_client_ip


def _request(forwarded_for=None):
    headers = {"HTTP_X_FORWARDED_FOR": forwarded_for} if forwarded_for else {}
    return RequestFactory().get("/", REMOTE_ADDR="10.0.0.1", **headers)


@pytest.fixture
def num_proxies(settings):
    def configure(value):
        settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": value}

    return configure


@pytest.mark.unit
class TestGetClientIp:
    def test_trusts_only_the_configured_hops(self, num_proxies):
        num_proxies(1)
        assert get_client_ip(_request("6.6.6.6, 203.0.113.7")) == "203.0.113.7"

    def test_uses_the_remote_address_without_a_header(self, num_proxies):
        num_proxies(1)
        assert get_client_ip(_request()) == "10.0.0.1"

    def test_ignores_the_header_with_zero_proxies(self, num_proxies):
        num_proxies(0)
        assert get_client_ip(_request("203.0.113.7")) == "10.0.0.1"

    def test_keeps_the_first_entry_when_unset(self, num_proxies):
        num_proxies(None)
        assert get_client_ip(_request("203.0.113.7, 10.0.0.2")) == "203.0.113.7"
