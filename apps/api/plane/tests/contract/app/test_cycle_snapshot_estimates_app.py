# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Cycle, CycleIssue, Estimate, EstimatePoint, Issue, Project, ProjectMember, State
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Snapshot Project", identifier="SNP", workspace=workspace, created_by=create_user, cycle_view=True
    )
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20, is_active=True)
    estimate = Estimate.objects.create(name="Points", type="points", project=project, workspace=workspace)
    project.estimate = estimate
    project.save()
    return project


def add_issue(project, cycle, user, group, points):
    state = State.objects.create(name=group, group=group, project=project, workspace=project.workspace)
    point = EstimatePoint.objects.create(
        estimate=project.estimate, key=points, value=str(points), project=project, workspace=project.workspace
    )
    issue = Issue.objects.create(
        name=group,
        project=project,
        workspace=project.workspace,
        state=state,
        estimate_point=point,
        created_by=user,
        type=link_starter_type(project),
    )
    CycleIssue.objects.create(cycle=cycle, issue=issue, project=project, workspace=project.workspace)


@pytest.mark.contract
@pytest.mark.django_db
def test_transfer_snapshot_keeps_estimate_points(session_client, workspace, project, create_user):
    cycle = Cycle.objects.create(
        name="Old",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=timezone.now() - timezone.timedelta(days=14),
        end_date=timezone.now() - timezone.timedelta(days=1),
    )
    new_cycle = Cycle.objects.create(
        name="New",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=timezone.now() + timezone.timedelta(days=1),
        end_date=timezone.now() + timezone.timedelta(days=14),
    )
    add_issue(project, cycle, create_user, "completed", 3)
    add_issue(project, cycle, create_user, "unstarted", 5)
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/cycles/{cycle.id}"

    response = session_client.post(f"{base}/transfer-issues/", {"new_cycle_id": str(new_cycle.id)}, format="json")
    assert response.status_code == status.HTTP_200_OK

    cycle.refresh_from_db()
    snapshot = cycle.progress_snapshot
    assert snapshot["total_estimate_points"] == 8
    assert snapshot["completed_estimate_points"] == 3
    assert snapshot["unstarted_estimate_points"] == 5

    progress = session_client.get(f"{base}/progress/")
    assert progress.status_code == status.HTTP_200_OK
    assert progress.data["total_estimate_points"] == 8
    assert progress.data["unstarted_estimate_points"] == 5
