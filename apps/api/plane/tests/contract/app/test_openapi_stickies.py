# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The sticky endpoints accept and return what the OpenAPI schema documents."""

import jsonschema
import pytest

from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query, documented_request

BASE = "/api/workspaces/{slug}/stickies/"


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestStickies:
    def test_create_list_and_update(self, session_client, workspace):
        body = {"description_html": "<p>note</p>", "background_color": "peach", "logo_props": {}}
        url, body = sent(BASE, "post", body, slug=workspace.slug)
        sticky = documented(session_client.post(url, body, format="json"), 201)
        page = documented(session_client.get(url, {"per_page": 5, "cursor": "5:0:0", "query": "note"}))
        assert [row["id"] for row in page["results"]] == [sticky["id"]]
        url, body = sent(BASE + "{pk}/", "patch", {"sort_order": 3.5}, slug=workspace.slug, pk=sticky["id"])
        assert documented(session_client.patch(url, body, format="json"))["sort_order"] == 3.5
        with pytest.raises(jsonschema.ValidationError):
            documented_request(BASE + "{pk}/", "patch", {"created_by": None})

    def test_query_parameters(self):
        assert documented_query(BASE, "get") == {"cursor", "per_page", "query"}
