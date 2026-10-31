# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The workspace favorite endpoints accept what the OpenAPI schema documents."""

import jsonschema
import pytest

from plane.db.models import ProjectMember, UserFavorite
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query, documented_request

BASE = "/api/workspaces/{slug}/user-favorites/"


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="FV")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestFavoriteRequests:
    def test_folder_and_entity(self, session_client, workspace, project):
        folder_body = {"entity_type": "folder", "is_folder": True, "name": "F", "parent": None, "project_id": None}
        url, body = sent(BASE, "post", folder_body, slug=workspace.slug)
        folder = documented(session_client.post(url, body, format="json"))
        entity_body = {
            "entity_type": "project",
            "entity_identifier": str(project.id),
            "project_id": str(project.id),
            "is_folder": False,
            "parent": None,
        }
        url, body = sent(BASE, "post", entity_body, slug=workspace.slug)
        favorite = documented(session_client.post(url, body, format="json"))
        route = BASE + "{favorite_id}/"
        url, body = sent(
            route, "patch", {"parent": folder["id"], "sequence": 3.5}, slug=workspace.slug, favorite_id=favorite["id"]
        )
        assert documented(session_client.patch(url, body, format="json"))["parent"] == folder["id"]
        assert UserFavorite.objects.get(pk=favorite["id"]).sequence == 3.5
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "patch", {"entity_type": "cycle"})

    def test_query_parameters(self):
        assert documented_query(BASE, "get") == set()
        assert documented_query(BASE + "{favorite_id}/group/", "get") == set()
