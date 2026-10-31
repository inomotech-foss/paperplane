# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The workspace dashboard endpoints accept what the OpenAPI schema documents."""

import jsonschema
import pytest

from plane.db.models import Issue, ProjectMember, State
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query, documented_request
from plane.utils.issue_type import link_starter_type

BASE = "/api/workspaces/{slug}/dashboards/"


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="DB")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    Issue.objects.create(name="a", project=project, workspace=workspace, state=state, type=link_starter_type(project))
    return project


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestDashboardRequests:
    def test_dashboard_and_widgets(self, session_client, workspace, project):
        body = {"name": "Board", "description": "", "logo_props": {"in_use": "emoji"}, "access": 1}
        url, body = sent(BASE, "post", body, slug=workspace.slug)
        dashboard = documented(session_client.post(url, body, format="json"), 201)
        url, body = sent(BASE + "{pk}/", "patch", {"name": "B2"}, slug=workspace.slug, pk=dashboard["id"])
        documented(session_client.patch(url, body, format="json"))
        widget_body = {
            "title": "By state",
            "chart_type": "bar",
            "query": "",
            "metric": {"function": "count"},
            "dimension": {"field": "state"},
            "series": {},
            "config": {"width": "full"},
        }
        route = BASE + "{dashboard_id}/widgets/"
        url, body = sent(route, "post", widget_body, slug=workspace.slug, dashboard_id=dashboard["id"])
        widget = documented(session_client.post(url, body, format="json"), 201)
        assert widget["config"] == {"width": "full"}
        route = BASE + "{dashboard_id}/widgets/{pk}/"
        url, body = sent(
            route, "patch", {"chart_type": "pie"}, slug=workspace.slug, dashboard_id=dashboard["id"], pk=widget["id"]
        )
        documented(session_client.patch(url, body, format="json"))
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "patch", {"metric": {"function": "median"}})

    def test_preview(self, session_client, workspace, project):
        body = {
            "chart_type": "table",
            "metric": {"function": "count"},
            "dimension": {"field": "created_at", "bucket": "week"},
        }
        url, body = sent(BASE + "preview/", "post", body, slug=workspace.slug)
        assert documented(session_client.post(url, body, format="json"))["dimension"]["bucket"] == "week"

    def test_query_parameters(self):
        assert documented_query(BASE, "get") == set()
        assert documented_query(BASE + "{dashboard_id}/widgets/", "get") == set()
