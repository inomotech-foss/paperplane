# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue, Project, ProjectMember, State
from plane.utils.build_chart import build_analytics_chart
from plane.utils.dashboard_widgets import evaluate_widget
from plane.utils.issue_type import link_starter_type


def make_project(workspace, user, identifier):
    project = Project.objects.create(name=identifier, identifier=identifier, workspace=workspace, created_by=user)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20, is_active=True)
    states = {
        name: State.objects.create(name=name, group=group, project=project, workspace=workspace)
        for name, group in (("Todo", "unstarted"), ("Done", "completed"))
    }
    return project, states


def add_issue(project, state, user):
    Issue.objects.create(
        name="item",
        project=project,
        workspace=project.workspace,
        state=state,
        created_by=user,
        type=link_starter_type(project),
    )


@pytest.fixture
def projects(db, workspace, create_user):
    first, first_states = make_project(workspace, create_user, "ONE")
    second, second_states = make_project(workspace, create_user, "TWO")
    add_issue(first, first_states["Done"], create_user)
    add_issue(first, first_states["Todo"], create_user)
    add_issue(second, second_states["Done"], create_user)
    add_issue(second, second_states["Done"], create_user)
    return (first, first_states), (second, second_states)


def counts_by_name(rows):
    return sorted((row["name"], row["count"]) for row in rows)


@pytest.mark.unit
@pytest.mark.django_db
def test_analytics_chart_merges_states_across_projects(workspace, projects):
    (_, first_states), _ = projects
    chart = build_analytics_chart(Issue.issue_objects.filter(workspace=workspace), "STATES")

    assert counts_by_name(chart["data"]) == [("Done", 3), ("Todo", 1)]
    assert str(first_states["Done"].id) in {row["key"] for row in chart["data"]}


@pytest.mark.unit
@pytest.mark.django_db
def test_analytics_chart_merges_state_series_across_projects(workspace, projects):
    chart = build_analytics_chart(Issue.issue_objects.filter(workspace=workspace), "PRIORITY", "STATES")

    assert sorted(chart["schema"].values()) == ["Done", "Todo"]
    assert chart["data"][0]["count"] == 4


@pytest.mark.unit
@pytest.mark.django_db
def test_analytics_chart_keeps_single_project_state_ids(projects):
    (first, first_states), _ = projects
    chart = build_analytics_chart(Issue.issue_objects.filter(project=first), "STATES")

    assert {row["key"] for row in chart["data"]} == {str(state.id) for state in first_states.values()}


@pytest.mark.unit
@pytest.mark.django_db
def test_dashboard_widget_merges_states_across_projects(workspace, create_user, projects):
    result = evaluate_widget({"chart_type": "bar", "dimension": {"field": "state"}}, create_user, workspace.slug)

    assert counts_by_name(result["data"]) == [("Done", 3), ("Todo", 1)]
