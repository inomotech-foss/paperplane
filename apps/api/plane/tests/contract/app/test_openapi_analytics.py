# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The advance analytics endpoints document the query params they read."""

import pytest

from plane.db.models import Issue, ProjectMember, State
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query
from plane.utils.issue_type import link_starter_type

WORKSPACE = "/api/workspaces/{slug}/"
PROJECT = "/api/workspaces/{slug}/projects/{project_id}/"
FILTERS = {"date_filter", "project_ids"}


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="AN")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    Issue.objects.create(name="a", project=project, workspace=workspace, state=state, type=link_starter_type(project))
    return project


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestAnalyticsQuery:
    def test_workspace_parameters(self, session_client, workspace, project):
        assert documented_query(WORKSPACE + "advance-analytics/", "get") == FILTERS | {"tab"}
        assert documented_query(WORKSPACE + "advance-analytics-stats/", "get") == FILTERS | {"type"}
        chart = FILTERS | {"type", "x_axis", "group_by"}
        assert documented_query(WORKSPACE + "advance-analytics-charts/", "get") == chart
        url = WORKSPACE.format(slug=workspace.slug)
        params = {"project_ids": str(project.id), "date_filter": "last_30_days"}
        assert documented(session_client.get(url + "advance-analytics/", {**params, "tab": "work-items"}))
        assert documented(session_client.get(url + "advance-analytics-stats/", {**params, "type": "work-items"}))
        custom = {**params, "type": "custom-work-items", "x_axis": "STATES", "group_by": "PRIORITY"}
        assert documented(session_client.get(url + "advance-analytics-charts/", custom))["data"]

    def test_project_parameters(self, session_client, workspace, project):
        scoped = FILTERS | {"cycle_id", "module_id"}
        assert documented_query(PROJECT + "advance-analytics/", "get") == scoped
        assert documented_query(PROJECT + "advance-analytics-stats/", "get") == scoped | {"type"}
        assert documented_query(PROJECT + "advance-analytics-charts/", "get") == scoped | {"type", "x_axis", "group_by"}
        url = PROJECT.format(slug=workspace.slug, project_id=project.id)
        assert documented(session_client.get(url + "advance-analytics-stats/", {"type": "work-items"}))
        custom = {"type": "custom-work-items", "x_axis": "PRIORITY"}
        assert documented(session_client.get(url + "advance-analytics-charts/", custom))["data"]
