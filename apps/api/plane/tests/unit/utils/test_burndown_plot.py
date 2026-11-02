# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.utils import timezone

from plane.db.models import (
    Cycle,
    CycleIssue,
    Estimate,
    EstimatePoint,
    Issue,
    Module,
    ModuleIssue,
    Project,
    State,
)
from plane.utils.analytics_plot import burndown_plot
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Burndown", identifier="BRN", workspace=workspace, created_by=create_user)
    project.estimate = Estimate.objects.create(name="Points", type="points", project=project, workspace=workspace)
    project.save()
    return project


@pytest.fixture
def items(project, create_user):
    def add(group, points):
        state = State.objects.create(name=group, group=group, project=project, workspace=project.workspace)
        point = EstimatePoint.objects.create(
            estimate=project.estimate, key=points, value=str(points), project=project, workspace=project.workspace
        )
        return Issue.objects.create(
            name=group,
            project=project,
            workspace=project.workspace,
            state=state,
            estimate_point=point,
            created_by=create_user,
            type=link_starter_type(project),
        )

    return [add("completed", 3), add("cancelled", 5), add("started", 2)]


def today_value(chart):
    return chart[str(timezone.now().date())]


@pytest.mark.unit
@pytest.mark.django_db
def test_cycle_burndown_leaves_out_cancelled_work(workspace, project, items, create_user):
    cycle = Cycle.objects.create(
        name="C",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=timezone.now() - timezone.timedelta(days=2),
        end_date=timezone.now() + timezone.timedelta(days=2),
    )
    for issue in items:
        CycleIssue.objects.create(cycle=cycle, issue=issue, project=project, workspace=workspace)

    args = {"queryset": cycle, "slug": workspace.slug, "project_id": project.id, "cycle_id": cycle.id}
    issues = burndown_plot(plot_type="issues", **args)
    points = burndown_plot(plot_type="points", **args)

    first = str((timezone.now() - timezone.timedelta(days=2)).date())
    assert issues[first] == 2
    assert today_value(issues) == 1
    assert points[first] == 5
    assert today_value(points) == 2

    items[2].state = State.objects.get(project=project, group="completed")
    items[2].save()
    assert today_value(burndown_plot(plot_type="issues", **args)) == 0


@pytest.mark.unit
@pytest.mark.django_db
def test_module_burndown_leaves_out_cancelled_work(workspace, project, items):
    today = timezone.now().date()
    module = Module.objects.create(
        name="M",
        project=project,
        workspace=workspace,
        start_date=today - timezone.timedelta(days=1),
        target_date=today + timezone.timedelta(days=1),
    )
    for issue in items:
        ModuleIssue.objects.create(module=module, issue=issue, project=project, workspace=workspace)

    args = {"queryset": module, "slug": workspace.slug, "project_id": project.id, "module_id": module.id}
    assert today_value(burndown_plot(plot_type="issues", **args)) == 1
    assert today_value(burndown_plot(plot_type="points", **args)) == 2
