# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Work item numbering through the external API: reading it, moving it forward, renumbering an item, releasing a number."""  # noqa: E501

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Issue, IssueSequence, Project, ProjectMember, State, User, WorkspaceMember
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Sales Funnel", identifier="ISFUN", workspace=workspace, created_by=create_user
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    State.objects.create(workspace=workspace, project=project, name="Backlog", color="#000000", default=True)
    return project


@pytest.fixture
def as_project_member(workspace, project, create_user):
    """Turn the API key's user into a plain member of the workspace and the project."""
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    ProjectMember.objects.filter(project=project, member=create_user).update(role=15)


def create_issue(project, name):
    return Issue.objects.create(
        workspace=project.workspace, project=project, name=name, type=link_starter_type(project)
    )


def sequence_url(workspace, project):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-item-sequence/"


def renumber_url(workspace, project, issue):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/{issue.id}/renumber/"


def detail_url(workspace, project, issue):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/{issue.id}/"


def release_url(workspace, project, sequence_id):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-item-sequence/{sequence_id}/"


def soft_delete(issue):
    """Delete a work item the way the app does, minus the Celery dispatch: the sequence row loses its work item."""
    Issue.objects.filter(pk=issue.pk).update(deleted_at=timezone.now())
    IssueSequence.objects.filter(issue=issue).update(issue=None)


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectWorkItemSequence:
    def test_reports_the_numbering(self, api_key_client, workspace, project):
        create_issue(project, "First")
        create_issue(project, "Second")

        response = api_key_client.get(sequence_url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"identifier": "ISFUN", "last_sequence": 2, "next_sequence": 3}

    def test_members_can_read_it(self, api_key_client, workspace, project, as_project_member):
        response = api_key_client.get(sequence_url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"identifier": "ISFUN", "last_sequence": 0, "next_sequence": 1}

    def test_non_members_cannot_read_it(self, api_key_client, workspace, project, create_user):
        ProjectMember.objects.filter(project=project, member=create_user).delete()

        response = api_key_client.get(sequence_url(workspace, project))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_moves_the_numbering_forward(self, api_key_client, workspace, project):
        first = create_issue(project, "First")

        response = api_key_client.post(sequence_url(workspace, project), {"start": 5000}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"identifier": "ISFUN", "last_sequence": 4999, "next_sequence": 5000}
        assert create_issue(project, "Second").sequence_id == 5000
        assert create_issue(project, "Third").sequence_id == 5001
        first.refresh_from_db()
        assert first.sequence_id == 1

    def test_rejects_a_start_at_or_below_the_current_maximum(self, api_key_client, workspace, project):
        create_issue(project, "First")
        create_issue(project, "Second")

        response = api_key_client.post(sequence_url(workspace, project), {"start": 2}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "greater than 2" in response.data["error"]
        assert not IssueSequence.objects.filter(project=project, issue__isnull=True).exists()

    @pytest.mark.parametrize("start", [None, "", "abc", "50.5", True, 1, 0])
    def test_rejects_an_invalid_start(self, api_key_client, workspace, project, start):
        response = api_key_client.post(sequence_url(workspace, project), {"start": start}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not IssueSequence.objects.filter(project=project).exists()

    def test_members_cannot_move_it(self, api_key_client, workspace, project, as_project_member):
        response = api_key_client.post(sequence_url(workspace, project), {"start": 5000}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not IssueSequence.objects.filter(project=project).exists()


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkItemRenumber:
    def test_renumbers_a_work_item(self, api_key_client, workspace, project):
        first = create_issue(project, "First")
        second = create_issue(project, "Second")

        response = api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 4711}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "id": str(first.id),
            "identifier": "ISFUN-4711",
            "previous_sequence_id": 1,
            "sequence_id": 4711,
        }
        first.refresh_from_db()
        second.refresh_from_db()
        assert (first.sequence_id, second.sequence_id) == (4711, 2)
        assert IssueSequence.objects.get(issue=first).sequence == 4711
        assert not IssueSequence.objects.filter(project=project, sequence=1).exists()

    def test_later_work_items_continue_after_the_new_number(self, api_key_client, workspace, project):
        first = create_issue(project, "First")

        api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 4711}, format="json")

        assert create_issue(project, "Second").sequence_id == 4712

    def test_a_freed_number_can_be_taken_by_a_renumbered_item(self, api_key_client, workspace, project):
        first = create_issue(project, "First")
        second = create_issue(project, "Second")
        api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 100}, format="json")

        response = api_key_client.post(renumber_url(workspace, project, second), {"sequence_id": 1}, format="json")

        assert response.status_code == status.HTTP_200_OK
        second.refresh_from_db()
        assert second.sequence_id == 1

    def test_renumbering_to_the_current_number_is_a_no_op(self, api_key_client, workspace, project):
        first = create_issue(project, "First")

        response = api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 1}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["previous_sequence_id"] == 1
        assert IssueSequence.objects.filter(issue=first).count() == 1

    def test_rejects_a_number_used_by_another_work_item(self, api_key_client, workspace, project):
        first = create_issue(project, "First")
        second = create_issue(project, "Second")

        response = api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 2}, format="json")

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "ISFUN-2" in response.data["error"]
        first.refresh_from_db()
        second.refresh_from_db()
        assert (first.sequence_id, second.sequence_id) == (1, 2)

    def test_rejects_a_number_of_a_deleted_work_item(self, api_key_client, workspace, project):
        first = create_issue(project, "First")
        deleted = create_issue(project, "Deleted")
        # Soft delete without going through Issue.delete(), which dispatches a Celery task.
        Issue.objects.filter(pk=deleted.pk).update(deleted_at=timezone.now())

        response = api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 2}, format="json")

        assert response.status_code == status.HTTP_409_CONFLICT

    def test_rejects_a_placeholder_number(self, api_key_client, workspace, project):
        first = create_issue(project, "First")
        api_key_client.post(sequence_url(workspace, project), {"start": 5000}, format="json")

        response = api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 4999}, format="json")

        assert response.status_code == status.HTTP_409_CONFLICT

    @pytest.mark.parametrize("sequence_id", [None, "", "abc", "4.5", True, 0, -1])
    def test_rejects_an_invalid_number(self, api_key_client, workspace, project, sequence_id):
        first = create_issue(project, "First")

        response = api_key_client.post(
            renumber_url(workspace, project, first), {"sequence_id": sequence_id}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        first.refresh_from_db()
        assert first.sequence_id == 1

    def test_members_cannot_renumber(self, api_key_client, workspace, project, as_project_member):
        first = create_issue(project, "First")

        response = api_key_client.post(renumber_url(workspace, project, first), {"sequence_id": 4711}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        first.refresh_from_db()
        assert first.sequence_id == 1

    def test_unknown_work_item_is_not_found(self, api_key_client, workspace, project):
        response = api_key_client.post(
            f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/{project.id}/renumber/",
            {"sequence_id": 4711},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_work_item_of_another_project_is_not_found(self, api_key_client, workspace, project, create_user):
        other = Project.objects.create(name="Other", identifier="OTHER", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(project=other, member=create_user, role=20, is_active=True)
        State.objects.create(workspace=workspace, project=other, name="Backlog", color="#000000", default=True)
        foreign = create_issue(other, "Foreign")

        response = api_key_client.post(renumber_url(workspace, project, foreign), {"sequence_id": 4711}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        foreign.refresh_from_db()
        assert foreign.sequence_id == 1

    def test_patching_a_work_item_cannot_change_its_number(self, api_key_client, workspace, project, mocker):
        # PATCH fans out to Celery (activity, webhooks, request log); none of that is under test here.
        mocker.patch("plane.api.views.issue.issue_activity.delay")
        mocker.patch("plane.api.views.issue.model_activity.delay")
        mocker.patch("plane.middleware.logger.process_logs.delay")
        first = create_issue(project, "First")

        response = api_key_client.patch(detail_url(workspace, project, first), {"sequence_id": 999}, format="json")

        assert response.status_code == status.HTTP_200_OK
        first.refresh_from_db()
        assert first.sequence_id == 1
        assert IssueSequence.objects.get(issue=first).sequence == 1


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkItemNumberRelease:
    def test_releases_the_number_of_a_deleted_work_item(self, api_key_client, workspace, project):
        create_issue(project, "First")
        soft_delete(create_issue(project, "Deleted"))
        create_issue(project, "Third")

        response = api_key_client.delete(release_url(workspace, project, 2))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"identifier": "ISFUN", "released": 2, "last_sequence": 3, "next_sequence": 4}
        assert not IssueSequence.all_objects.filter(project=project, sequence=2).exists()

    def test_a_released_number_can_be_taken_by_a_renumbered_work_item(self, api_key_client, workspace, project):
        create_issue(project, "First")
        soft_delete(create_issue(project, "Deleted"))
        third = create_issue(project, "Third")
        api_key_client.delete(release_url(workspace, project, 2))

        response = api_key_client.post(renumber_url(workspace, project, third), {"sequence_id": 2}, format="json")

        assert response.status_code == status.HTTP_200_OK
        third.refresh_from_db()
        assert third.sequence_id == 2
        assert IssueSequence.objects.filter(project=project, sequence=2).count() == 1

    def test_releasing_the_highest_number_hands_it_to_the_next_work_item(self, api_key_client, workspace, project):
        create_issue(project, "First")
        soft_delete(create_issue(project, "Deleted"))

        response = api_key_client.delete(release_url(workspace, project, 2))

        assert response.data["next_sequence"] == 2
        assert create_issue(project, "Second again").sequence_id == 2

    def test_releases_a_placeholder(self, api_key_client, workspace, project):
        first = create_issue(project, "First")
        api_key_client.post(sequence_url(workspace, project), {"start": 5000}, format="json")

        response = api_key_client.delete(release_url(workspace, project, 4999))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["next_sequence"] == 2
        first.refresh_from_db()
        assert first.sequence_id == 1

    def test_refuses_the_number_of_an_existing_work_item(self, api_key_client, workspace, project):
        first = create_issue(project, "First")

        response = api_key_client.delete(release_url(workspace, project, 1))

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "ISFUN-1" in response.data["error"]
        assert IssueSequence.objects.get(issue=first).sequence == 1

    def test_refuses_the_number_of_an_archived_work_item(self, api_key_client, workspace, project):
        first = create_issue(project, "First")
        Issue.objects.filter(pk=first.pk).update(archived_at=timezone.now().date())

        response = api_key_client.delete(release_url(workspace, project, 1))

        assert response.status_code == status.HTTP_409_CONFLICT

    def test_an_unrecorded_number_is_not_found(self, api_key_client, workspace, project):
        create_issue(project, "First")

        response = api_key_client.delete(release_url(workspace, project, 42))

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "ISFUN-42" in response.data["error"]

    def test_zero_is_rejected(self, api_key_client, workspace, project):
        response = api_key_client.delete(release_url(workspace, project, 0))

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_members_cannot_release(self, api_key_client, workspace, project, as_project_member):
        create_issue(project, "First")
        soft_delete(create_issue(project, "Deleted"))

        response = api_key_client.delete(release_url(workspace, project, 2))

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert IssueSequence.objects.filter(project=project, sequence=2).exists()

    def test_other_projects_are_untouched(self, api_key_client, workspace, project, create_user):
        other = Project.objects.create(name="Other", identifier="OTHER", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(project=other, member=create_user, role=20, is_active=True)
        State.objects.create(workspace=workspace, project=other, name="Backlog", color="#000000", default=True)
        soft_delete(create_issue(other, "Deleted elsewhere"))
        soft_delete(create_issue(project, "Deleted here"))

        response = api_key_client.delete(release_url(workspace, project, 1))

        assert response.status_code == status.HTTP_200_OK
        assert IssueSequence.objects.filter(project=other, sequence=1).exists()
        assert not IssueSequence.objects.filter(project=project, sequence=1).exists()


@pytest.mark.contract
@pytest.mark.django_db
def test_unrelated_user_cannot_touch_the_numbering(api_client, workspace, project):
    User.objects.create(email="stranger@plane.so", username="stranger")

    response = api_client.post(sequence_url(workspace, project), {"start": 5000}, format="json")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
