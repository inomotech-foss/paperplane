# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.conf import settings
from django.utils import timezone

from plane.bgtasks.deletion_task import hard_delete, soft_delete_related_objects
from plane.db.models import DeployBoard, Intake, Issue, IssueType, Project, ServiceDeskConfig, Workspace
from plane.utils.issue_type import link_starter_type


def long_ago():
    return timezone.now() - timezone.timedelta(days=settings.HARD_DELETE_AFTER_DAYS + 1)


def typed_project(workspace, identifier):
    project = Project.objects.create(name=identifier, identifier=identifier, workspace=workspace)
    task = link_starter_type(project)
    Issue.objects.create(name="Live", workspace=workspace, project=project, type=task)
    Issue.objects.create(name="Deleted", workspace=workspace, project=project, type=task, deleted_at=timezone.now())
    publish_intake_form(project, task)
    ServiceDeskConfig.objects.create(
        project=project, mailbox_email="desk@example.com", is_enabled=True, issue_type=task
    )
    return project, task


def publish_intake_form(project, issue_type):
    intake = Intake.objects.create(name="Intake", workspace=project.workspace, project=project)
    return DeployBoard.objects.create(
        entity_name="project",
        entity_identifier=project.id,
        project=project,
        intake=intake,
        intake_issue_type=issue_type,
    )


@pytest.mark.unit
@pytest.mark.django_db
def test_soft_deleting_a_type_leaves_its_work_items_alone(workspace):
    project = Project.objects.create(name="Ops", identifier="OPS", workspace=workspace)
    issue_type = IssueType.objects.create(workspace=workspace, name="Spike")
    issue = Issue.objects.create(name="Item", workspace=workspace, project=project, type=issue_type)
    board = publish_intake_form(project, issue_type)
    desk = ServiceDeskConfig.objects.create(project=project, mailbox_email="desk@example.com", issue_type=issue_type)
    IssueType.objects.filter(pk=issue_type.pk).update(deleted_at=timezone.now())

    soft_delete_related_objects("db", "issuetype", issue_type.pk)

    issue = Issue.all_objects.get(pk=issue.pk)
    assert (issue.type_id, issue.deleted_at) == (issue_type.id, None)
    assert DeployBoard.all_objects.get(pk=board.pk).deleted_at is None
    assert ServiceDeskConfig.all_objects.get(pk=desk.pk).deleted_at is None


@pytest.mark.unit
@pytest.mark.django_db
def test_the_nightly_purge_removes_a_deleted_workspace_with_typed_work_items(create_user):
    workspace = Workspace.objects.create(name="Gone", slug="gone", owner=create_user)
    project, task = typed_project(workspace, "GONE")
    Workspace.objects.filter(pk=workspace.pk).update(deleted_at=long_ago())

    hard_delete()

    assert not Workspace.all_objects.filter(pk=workspace.pk).exists()
    assert not Issue.all_objects.filter(project_id=project.id).exists()
    assert not DeployBoard.all_objects.filter(project_id=project.id).exists()
    assert not ServiceDeskConfig.all_objects.filter(project_id=project.id).exists()
    assert not IssueType.all_objects.filter(pk=task.pk).exists()


@pytest.mark.unit
@pytest.mark.django_db
def test_the_nightly_purge_removes_a_deleted_project_and_keeps_its_types(workspace):
    project, task = typed_project(workspace, "OLD")
    kept, _ = typed_project(workspace, "KEPT")
    Project.objects.filter(pk=project.pk).update(deleted_at=long_ago())

    hard_delete()

    assert not Project.all_objects.filter(pk=project.pk).exists()
    assert not Issue.all_objects.filter(project_id=project.id).exists()
    assert not DeployBoard.all_objects.filter(project_id=project.id).exists()
    assert not ServiceDeskConfig.all_objects.filter(project_id=project.id).exists()
    assert IssueType.objects.filter(pk=task.pk).exists()
    assert Issue.objects.filter(project=kept).count() == 1
