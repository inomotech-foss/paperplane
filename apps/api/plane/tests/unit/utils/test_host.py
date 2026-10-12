# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.utils.host import absolute_app_url

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def app_url(settings):
    settings.APP_BASE_URL = "https://plane.example.com/"


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("/api/assets/v2/static/1/", "https://plane.example.com/api/assets/v2/static/1/"),
        ("api/assets/v2/static/1/", "https://plane.example.com/api/assets/v2/static/1/"),
        ("https://bucket.s3.amazonaws.com/avatar.png", "https://bucket.s3.amazonaws.com/avatar.png"),
        ("//cdn.example.com/avatar.png", "//cdn.example.com/avatar.png"),
        (None, None),
        ("", None),
    ],
)
def test_absolute_app_url(url, expected):
    assert absolute_app_url(url) == expected
