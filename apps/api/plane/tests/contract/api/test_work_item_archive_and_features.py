# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Archiving work items, removing a relation, and reading project features."""

import pytest
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueRelation,
    Project,
    ProjectMember,
    State,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def done_state(db, workspace, project):
    return State.objects.create(name="Done", group="completed", project=project, workspace=workspace)


@pytest.fixture
def open_state(db, workspace, project):
    return State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace)


def make_issue(project, workspace, state, name):
    return Issue.objects.create(name=name, project=project, workspace=workspace, state=state)


def archive_url(slug, project_id, issue_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/archive/"


def unarchive_url(slug, project_id, issue_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/unarchive/"


def archived_list_url(slug, project_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/archived-work-items/"


def relation_remove_url(slug, project_id, issue_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/relations/remove/"


def features_url(slug, project_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/features/"


@pytest.mark.contract
class TestWorkItemArchive:
    @pytest.mark.django_db
    def test_archiving_a_finished_work_item(self, api_key_client, workspace, project, done_state):
        issue = make_issue(project, workspace, done_state, "Finished")

        response = api_key_client.post(archive_url(workspace.slug, project.id, issue.id))

        assert response.status_code == status.HTTP_200_OK
        issue.refresh_from_db()
        assert issue.archived_at is not None

    @pytest.mark.django_db
    def test_an_open_work_item_cannot_be_archived(self, api_key_client, workspace, project, open_state):
        issue = make_issue(project, workspace, open_state, "Still going")

        response = api_key_client.post(archive_url(workspace.slug, project.id, issue.id))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        issue.refresh_from_db()
        assert issue.archived_at is None

    @pytest.mark.django_db
    def test_unarchiving_puts_it_back(self, api_key_client, workspace, project, done_state):
        issue = make_issue(project, workspace, done_state, "Finished")
        api_key_client.post(archive_url(workspace.slug, project.id, issue.id))

        response = api_key_client.post(unarchive_url(workspace.slug, project.id, issue.id))

        assert response.status_code == status.HTTP_200_OK
        issue.refresh_from_db()
        assert issue.archived_at is None

    @pytest.mark.django_db
    def test_the_archived_list_holds_only_archived_work_items(
        self, api_key_client, workspace, project, done_state, open_state
    ):
        archived = make_issue(project, workspace, done_state, "Finished")
        make_issue(project, workspace, open_state, "Still going")
        api_key_client.post(archive_url(workspace.slug, project.id, archived.id))

        response = api_key_client.get(archived_list_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_200_OK
        assert [item["name"] for item in response.data["results"]] == ["Finished"]

    @pytest.mark.django_db
    def test_unauthenticated_request_rejected(self, api_client, workspace, project):
        assert api_client.get(archived_list_url(workspace.slug, project.id)).status_code == (
            status.HTTP_401_UNAUTHORIZED
        )


@pytest.mark.contract
class TestRelationRemoval:
    @pytest.mark.django_db
    def test_removing_a_relation(self, api_key_client, workspace, project, open_state):
        issue = make_issue(project, workspace, open_state, "One")
        other = make_issue(project, workspace, open_state, "Two")
        IssueRelation.objects.create(
            issue=issue, related_issue=other, relation_type="blocked_by", project=project, workspace=workspace
        )

        response = api_key_client.post(
            relation_remove_url(workspace.slug, project.id, issue.id),
            {"related_issue": str(other.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not IssueRelation.objects.filter(issue=issue, related_issue=other).exists()

    @pytest.mark.django_db
    def test_the_stored_direction_does_not_matter(self, api_key_client, workspace, project, open_state):
        issue = make_issue(project, workspace, open_state, "One")
        other = make_issue(project, workspace, open_state, "Two")
        # Stored the other way round, as a "blocking" relation would be.
        IssueRelation.objects.create(
            issue=other, related_issue=issue, relation_type="blocked_by", project=project, workspace=workspace
        )

        response = api_key_client.post(
            relation_remove_url(workspace.slug, project.id, issue.id),
            {"related_issue": str(other.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not IssueRelation.objects.filter(issue=other, related_issue=issue).exists()

    @pytest.mark.django_db
    def test_an_absent_relation_reports_not_found(self, api_key_client, workspace, project, open_state):
        issue = make_issue(project, workspace, open_state, "One")
        other = make_issue(project, workspace, open_state, "Two")

        response = api_key_client.post(
            relation_remove_url(workspace.slug, project.id, issue.id),
            {"related_issue": str(other.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_a_missing_related_issue_is_refused(self, api_key_client, workspace, project, open_state):
        issue = make_issue(project, workspace, open_state, "One")

        response = api_key_client.post(relation_remove_url(workspace.slug, project.id, issue.id), {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
class TestProjectFeatures:
    @pytest.mark.django_db
    def test_reading_the_features(self, api_key_client, workspace, project):
        project.cycle_view = True
        project.module_view = False
        project.save()

        response = api_key_client.get(features_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["cycles"] is True
        assert response.data["modules"] is False
        # Features we have no column for are left out rather than reported off.
        assert "workflows" not in response.data

    @pytest.mark.django_db
    def test_switching_a_feature_on(self, api_key_client, workspace, project):
        project.module_view = False
        project.save()

        response = api_key_client.patch(features_url(workspace.slug, project.id), {"modules": True}, format="json")

        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.module_view is True

    @pytest.mark.django_db
    def test_untouched_features_stay_as_they_were(self, api_key_client, workspace, project):
        project.cycle_view = True
        project.module_view = False
        project.save()

        api_key_client.patch(features_url(workspace.slug, project.id), {"modules": True}, format="json")

        project.refresh_from_db()
        assert project.cycle_view is True

    @pytest.mark.django_db
    def test_a_feature_we_do_not_have_is_refused(self, api_key_client, workspace, project):
        response = api_key_client.patch(features_url(workspace.slug, project.id), {"workflows": True}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "workflows" in response.data["error"]

    @pytest.mark.django_db
    def test_a_non_boolean_is_refused(self, api_key_client, workspace, project):
        response = api_key_client.patch(features_url(workspace.slug, project.id), {"modules": "yes"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
