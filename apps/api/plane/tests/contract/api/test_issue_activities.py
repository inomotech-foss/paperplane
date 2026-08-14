# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for importing history via the public v1 activities endpoint."""

from datetime import datetime, timezone as dt_timezone

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueActivity, Project, ProjectMember, State


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def issue(db, workspace, project, create_user):
    state = State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace)
    return Issue.objects.create(
        name="Test Issue", project=project, workspace=workspace, state=state, created_by=create_user
    )


def base_url(slug, project_id, issue_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/activities/"


@pytest.mark.contract
class TestIssueActivityImportV1Endpoint:
    @pytest.mark.django_db
    def test_import_batch_preserves_timestamps(self, api_key_client, workspace, project, issue):
        url = base_url(workspace.slug, project.id, issue.id)
        response = api_key_client.post(
            url,
            {
                "activities": [
                    {
                        "verb": "updated",
                        "field": "state",
                        "old_value": "Todo",
                        "new_value": "In Progress",
                        "comment": "changed state",
                        "created_at": "2021-03-04T10:00:00Z",
                        "external_source": "jira",
                        "external_id": "TP-1/1",
                    },
                    {
                        "verb": "updated",
                        "field": "priority",
                        "old_value": "low",
                        "new_value": "high",
                        "comment": "changed priority",
                        "created_at": "2021-05-06T12:30:00Z",
                        "external_source": "jira",
                        "external_id": "TP-1/2",
                    },
                ]
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["created"] == 2
        assert response.data["skipped"] == 0

        # the original timestamps survive, rather than being stamped with "now"
        first = IssueActivity.objects.get(external_id="TP-1/1")
        assert first.created_at == datetime(2021, 3, 4, 10, 0, tzinfo=dt_timezone.utc)
        assert first.epoch == int(first.created_at.timestamp())
        assert first.field == "state"

    @pytest.mark.django_db
    def test_rerun_is_idempotent(self, api_key_client, workspace, project, issue):
        url = base_url(workspace.slug, project.id, issue.id)
        payload = {
            "activities": [
                {
                    "verb": "updated",
                    "field": "state",
                    "new_value": "Done",
                    "external_source": "jira",
                    "external_id": "TP-1/1",
                }
            ]
        }
        assert api_key_client.post(url, payload, format="json").data["created"] == 1
        again = api_key_client.post(url, payload, format="json")
        assert again.data["created"] == 0
        assert again.data["skipped"] == 1
        assert IssueActivity.objects.filter(external_id="TP-1/1").count() == 1

    @pytest.mark.django_db
    def test_duplicates_within_one_batch_collapse(self, api_key_client, workspace, project, issue):
        url = base_url(workspace.slug, project.id, issue.id)
        entry = {
            "verb": "updated",
            "field": "state",
            "new_value": "Done",
            "external_source": "jira",
            "external_id": "TP-1/1",
        }
        response = api_key_client.post(url, {"activities": [entry, entry]}, format="json")
        assert response.data["created"] == 1
        assert response.data["skipped"] == 1

    @pytest.mark.django_db
    def test_import_emits_no_activity_of_its_own(self, api_key_client, workspace, project, issue):
        """A migration replays thousands of past events; it must not generate new ones."""
        url = base_url(workspace.slug, project.id, issue.id)
        api_key_client.post(
            url,
            {
                "activities": [
                    {
                        "verb": "updated",
                        "field": "state",
                        "new_value": "Done",
                        "external_source": "jira",
                        "external_id": "TP-1/1",
                    }
                ]
            },
            format="json",
        )
        # exactly the row we imported, no "updated the issue" side effect
        assert IssueActivity.objects.filter(issue_id=issue.id).count() == 1

    @pytest.mark.django_db
    def test_single_object_body_is_accepted(self, api_key_client, workspace, project, issue):
        url = base_url(workspace.slug, project.id, issue.id)
        response = api_key_client.post(url, {"verb": "updated", "field": "labels", "new_value": "bug"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["created"] == 1

    @pytest.mark.django_db
    def test_entry_without_field_or_comment_is_rejected(self, api_key_client, workspace, project, issue):
        url = base_url(workspace.slug, project.id, issue.id)
        response = api_key_client.post(url, {"activities": [{"verb": "updated"}]}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_unknown_issue_is_404(self, api_key_client, workspace, project):
        url = base_url(workspace.slug, project.id, "00000000-0000-0000-0000-000000000000")
        response = api_key_client.post(url, {"activities": [{"verb": "updated", "field": "state"}]}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_imported_history_is_listed(self, api_key_client, workspace, project, issue):
        url = base_url(workspace.slug, project.id, issue.id)
        api_key_client.post(
            url,
            {
                "activities": [
                    {
                        "verb": "updated",
                        "field": "state",
                        "new_value": "Done",
                        "created_at": "2021-03-04T10:00:00Z",
                        "external_source": "jira",
                        "external_id": "TP-1/1",
                    }
                ]
            },
            format="json",
        )
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["external_id"] == "TP-1/1"
