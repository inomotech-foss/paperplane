# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Removing a work item type moves every row that still uses it to a replacement."""

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import (
    Automation,
    AutomationAction,
    DraftIssue,
    Intake,
    Issue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
)


@pytest.fixture
def types(db, workspace):
    return {name: IssueType.objects.create(workspace=workspace, name=name) for name in ("Task", "Bug", "Story")}


def make_project(workspace, user, identifier, links):
    project = Project.objects.create(
        name=identifier.title(), identifier=identifier, workspace=workspace, created_by=user
    )
    ProjectMember.objects.create(project=project, member=user, role=20, is_active=True)
    for issue_type in links:
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return project


@pytest.fixture
def sales(workspace, create_user, types):
    return make_project(workspace, create_user, "SAL", types.values())


@pytest.fixture
def ops(workspace, create_user, types):
    return make_project(workspace, create_user, "OPS", [types["Task"], types["Story"]])


def make_rows(workspace, project, issue_type):
    """One of every kind of row that can point at a type."""
    rows = {
        "live": Issue.objects.create(name="live", workspace=workspace, project=project, type=issue_type),
        "archived": Issue.objects.create(
            name="archived", workspace=workspace, project=project, type=issue_type, archived_at=timezone.now().date()
        ),
        "deleted": Issue.objects.create(
            name="deleted", workspace=workspace, project=project, type=issue_type, deleted_at=timezone.now()
        ),
        "draft": DraftIssue.objects.create(name="draft", workspace=workspace, project=project, type=issue_type),
        "intake": Intake.objects.create(name="Intake", workspace=workspace, project=project, issue_type=issue_type),
    }
    automation = Automation.objects.create(workspace=workspace, project=project, name="Rule")
    rows["action"] = AutomationAction.objects.create(
        workspace=workspace,
        automation=automation,
        action_type="create_work_item",
        config={"name": "Follow up", "type_id": str(issue_type.id)},
    )
    return rows


def type_of(row):
    model = type(row)
    current = model.all_objects.get(pk=row.pk)
    if isinstance(current, Intake):
        return current.issue_type_id
    if isinstance(current, AutomationAction):
        return current.config["type_id"]
    return current.type_id


def unlink_url(workspace, project, issue_type, replacement=None):
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-types/{issue_type.id}/"
    return f"{url}?replacement_type_id={replacement.id}" if replacement else url


def workspace_delete_url(workspace, issue_type, replacement=None):
    url = f"/api/v1/workspaces/{workspace.slug}/work-item-types/{issue_type.id}/"
    return f"{url}?replacement_type_id={replacement.id}" if replacement else url


def is_linked(project, issue_type):
    return ProjectIssueType.objects.filter(project=project, issue_type=issue_type).exists()


@pytest.mark.contract
@pytest.mark.django_db
class TestUsage:
    def test_counts_every_row_of_the_project(self, session_client, workspace, sales, ops, types):
        make_rows(workspace, sales, types["Story"])
        make_rows(workspace, ops, types["Story"])

        response = session_client.get(f"{unlink_url(workspace, sales, types['Story'])}usage/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "work_items": 2,
            "deleted_work_items": 1,
            "drafts": 1,
            "intakes": 1,
            "automation_actions": 1,
        }

    def test_an_unused_type_has_no_rows(self, session_client, workspace, sales, types):
        response = session_client.get(f"{unlink_url(workspace, sales, types['Story'])}usage/")

        assert set(response.data.values()) == {0}


@pytest.mark.contract
@pytest.mark.django_db
class TestUnlink:
    def test_an_unused_type_needs_no_replacement(self, session_client, workspace, sales, types):
        response = session_client.delete(unlink_url(workspace, sales, types["Story"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not is_linked(sales, types["Story"])

    def test_a_replacement_for_an_unused_type_is_ignored(self, session_client, workspace, sales, types):
        response = session_client.delete(unlink_url(workspace, sales, types["Story"], types["Bug"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not is_linked(sales, types["Story"])

    def test_a_used_type_needs_a_replacement(self, session_client, workspace, sales, types):
        rows = make_rows(workspace, sales, types["Story"])

        response = session_client.delete(unlink_url(workspace, sales, types["Story"]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Work items still use the type Story. Choose a type to move them to."
        assert is_linked(sales, types["Story"])
        assert {type_of(row) for row in rows.values()} == {types["Story"].id, str(types["Story"].id)}

    def test_deleted_work_items_alone_still_need_a_replacement(self, session_client, workspace, sales, types):
        deleted = Issue.objects.create(
            name="deleted", workspace=workspace, project=sales, type=types["Story"], deleted_at=timezone.now()
        )

        response = session_client.delete(unlink_url(workspace, sales, types["Story"]))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response = session_client.delete(unlink_url(workspace, sales, types["Story"], types["Bug"]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert type_of(deleted) == types["Bug"].id

    def test_every_row_of_the_project_moves(self, session_client, workspace, sales, ops, types):
        rows = make_rows(workspace, sales, types["Story"])
        elsewhere = make_rows(workspace, ops, types["Story"])

        response = session_client.delete(unlink_url(workspace, sales, types["Story"], types["Bug"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert {str(type_of(row)) for row in rows.values()} == {str(types["Bug"].id)}
        assert {str(type_of(row)) for row in elsewhere.values()} == {str(types["Story"].id)}
        assert not is_linked(sales, types["Story"])
        assert IssueType.objects.filter(pk=types["Story"].pk).exists()

    def test_the_type_goes_once_nothing_links_or_uses_it(self, session_client, workspace, sales, types):
        make_rows(workspace, sales, types["Story"])

        session_client.delete(unlink_url(workspace, sales, types["Story"], types["Bug"]))

        assert not IssueType.objects.filter(pk=types["Story"].pk).exists()

    @pytest.mark.parametrize(
        "replacement,message",
        [
            ("Story", "Choose a different type to move the work items to."),
            ("inactive", "The replacement type must be an active type of this workspace."),
            ("epic", "Epics can only move to an epic type, and other work items only to a type that is not an epic."),
            ("unlinked", "The type Unlinked is not enabled in these projects: Sal (SAL)."),
        ],
    )
    def test_an_invalid_replacement_is_rejected(self, session_client, workspace, sales, types, replacement, message):
        rows = make_rows(workspace, sales, types["Story"])
        options = {
            "Story": types["Story"],
            "inactive": IssueType.objects.create(workspace=workspace, name="Old", is_active=False),
            "epic": IssueType.objects.create(workspace=workspace, name="Epic", is_epic=True),
            "unlinked": IssueType.objects.create(workspace=workspace, name="Unlinked"),
        }
        for issue_type in options.values():
            if issue_type.name != "Unlinked" and not is_linked(sales, issue_type):
                ProjectIssueType.objects.create(project=sales, issue_type=issue_type, workspace=workspace)

        response = session_client.delete(unlink_url(workspace, sales, types["Story"], options[replacement]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == message
        assert type_of(rows["live"]) == types["Story"].id

    def test_an_unknown_replacement_is_rejected(self, session_client, workspace, sales, types):
        make_rows(workspace, sales, types["Story"])
        url = f"{unlink_url(workspace, sales, types['Story'])}?replacement_type_id=11111111-1111-4111-8111-111111111111"

        response = session_client.delete(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "The replacement type does not exist."

    def test_the_last_active_type_stays(self, session_client, workspace, create_user, types):
        only = make_project(workspace, create_user, "ONE", [types["Task"]])

        response = session_client.delete(unlink_url(workspace, only, types["Task"]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "A project must have at least one work item type"

    def test_the_public_api_moves_rows_too(self, api_key_client, workspace, sales, types):
        rows = make_rows(workspace, sales, types["Story"])
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{sales.id}/work-item-types/{types['Story'].id}/"

        assert api_key_client.delete(url).status_code == status.HTTP_400_BAD_REQUEST
        response = api_key_client.delete(f"{url}?replacement_type_id={types['Bug'].id}")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert {str(type_of(row)) for row in rows.values()} == {str(types["Bug"].id)}


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceDelete:
    def test_rows_of_every_project_move(self, api_key_client, workspace, sales, ops, types):
        rows = [
            *make_rows(workspace, sales, types["Story"]).values(),
            *make_rows(workspace, ops, types["Story"]).values(),
        ]

        response = api_key_client.delete(workspace_delete_url(workspace, types["Story"], types["Task"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert {str(type_of(row)) for row in rows} == {str(types["Task"].id)}
        assert not IssueType.objects.filter(pk=types["Story"].pk).exists()
        assert not ProjectIssueType.objects.filter(issue_type=types["Story"]).exists()

    def test_the_replacement_must_be_linked_in_every_project(self, api_key_client, workspace, sales, ops, types):
        make_rows(workspace, sales, types["Story"])
        make_rows(workspace, ops, types["Story"])

        response = api_key_client.delete(workspace_delete_url(workspace, types["Story"], types["Bug"]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "The type Bug is not enabled in these projects: Ops (OPS)."
        assert IssueType.objects.filter(pk=types["Story"].pk).exists()

    def test_rows_of_deleted_projects_move_without_a_link(self, api_key_client, workspace, sales, ops, types):
        rows = make_rows(workspace, ops, types["Story"])
        ops.delete()

        response = api_key_client.delete(workspace_delete_url(workspace, types["Story"], types["Bug"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert type_of(rows["deleted"]) == types["Bug"].id

    def test_an_unused_type_needs_no_replacement(self, api_key_client, workspace, sales, types):
        response = api_key_client.delete(workspace_delete_url(workspace, types["Story"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not IssueType.objects.filter(pk=types["Story"].pk).exists()
