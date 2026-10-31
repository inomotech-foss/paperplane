# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The project and workspace view endpoints accept what the OpenAPI schema documents."""

import jsonschema
import pytest

from plane.db.models import Issue, IssueView, ProjectMember, State, UserFavorite
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query, documented_request
from plane.utils.issue_type import link_starter_type

BASE = "/api/workspaces/{slug}"


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="VW")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


VIEW_BODY = {
    "name": "Mine",
    "description": "d",
    "rich_filters": {"priority__in": "high"},
    "display_filters": {"layout": "list"},
    "display_properties": {"key": True},
    "logo_props": {"in_use": "emoji"},
}


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestViewRequests:
    def test_project_views(self, session_client, workspace, project):
        ids = {"slug": workspace.slug, "project_id": project.id}
        url, body = sent(BASE + "/projects/{project_id}/views/", "post", VIEW_BODY, **ids)
        view = documented(session_client.post(url, body, format="json"), 201)
        route = BASE + "/projects/{project_id}/views/{pk}/"
        url, body = sent(route, "patch", {"display_filters": {"layout": "kanban"}}, pk=view["id"], **ids)
        assert documented(session_client.patch(url, body, format="json"))["display_filters"] == {"layout": "kanban"}
        assert documented(session_client.get(BASE.format(**ids) + f"/projects/{project.id}/views/"))
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "patch", {"access": 0})

    def test_workspace_views(self, session_client, workspace):
        url, body = sent(BASE + "/views/", "post", VIEW_BODY, slug=workspace.slug)
        view = documented(session_client.post(url, body, format="json"), 201)
        url, body = sent(BASE + "/views/{pk}/", "patch", {"name": "Renamed"}, slug=workspace.slug, pk=view["id"])
        assert documented(session_client.patch(url, body, format="json"))["name"] == "Renamed"

    def test_view_favorite(self, session_client, create_user, workspace, project):
        view = IssueView.objects.create(name="V", project=project, workspace=workspace, owned_by=create_user)
        ids = {"slug": workspace.slug, "project_id": project.id}
        url, body = sent(BASE + "/projects/{project_id}/user-favorite-views/", "post", {"view": str(view.id)}, **ids)
        assert session_client.post(url, body, format="json").status_code == 204
        assert UserFavorite.objects.filter(entity_type="view", entity_identifier=view.id).exists()

    def test_query_parameters(self, session_client, create_user, workspace, project):
        assert documented_query(BASE + "/views/", "get") == set()
        assert documented_query(BASE + "/projects/{project_id}/views/", "get") == set()
        expected = {"cursor", "per_page", "order_by", "sub_issue", "filters", "pql", "layout", "state", "priority"}
        assert expected <= documented_query(BASE + "/issues/", "get")
        state = State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace)
        Issue.objects.create(
            name="a", project=project, workspace=workspace, state=state, type=link_starter_type(project)
        )
        params = {"per_page": 10, "order_by": "-created_at", "sub_issue": "false", "priority": "none"}
        assert documented(session_client.get(BASE.format(slug=workspace.slug) + "/issues/", params))["results"]
