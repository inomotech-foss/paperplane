# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The Unsplash search forwards the page number as a number and the query encoded."""

from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.contract
@pytest.mark.django_db
def test_search_sends_the_page_number(session_client):
    response = MagicMock(status_code=200)
    response.json.return_value = {"results": []}
    with (
        patch("plane.app.views.external.base.get_configuration_value", return_value=("key",)),
        patch("plane.app.views.external.base.requests.get", return_value=response) as get,
    ):
        assert session_client.get("/api/unsplash/", {"query": "sea", "page": 2}).status_code == 200
    assert "&page=2&" in get.call_args.kwargs["url"]


@pytest.mark.contract
@pytest.mark.django_db
def test_search_encodes_the_query(session_client):
    response = MagicMock(status_code=200)
    response.json.return_value = {"results": []}
    with (
        patch("plane.app.views.external.base.get_configuration_value", return_value=("key",)),
        patch("plane.app.views.external.base.requests.get", return_value=response) as get,
    ):
        session_client.get("/api/unsplash/", {"query": "sea & sky"})
    assert "&query=sea%20%26%20sky&" in get.call_args.kwargs["url"]
