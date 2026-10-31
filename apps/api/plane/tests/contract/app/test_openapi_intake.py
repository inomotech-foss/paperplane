# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The intake and service desk endpoints take and return what the OpenAPI schema documents."""

from unittest import mock

import pytest

from plane.db.models import (
    FileAsset,
    Intake,
    IntakeIssue,
    IssueEmailThread,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, documented_query, documented_request, no_tasks  # noqa: F401
from plane.utils.issue_type import link_starter_type

BASE = "/api/workspaces/{slug}/projects/{project_id}"


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="INT", intake_view=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    Intake.objects.create(name="Intake", project=project, workspace=workspace, is_default=True)
    return project


@pytest.fixture
def ids(workspace, project):
    return {"slug": workspace.slug, "project_id": project.id}


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


def create_intake_issue(session_client, project, ids, name="Ticket"):
    body = {"issue": {"name": name, "priority": "high", "type_id": str(link_starter_type(project).id)}}
    url, body = sent(BASE + "/inbox-issues/", "post", body, **ids)
    return documented(session_client.post(url, body, format="json"))


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestIntakeIssues:
    def test_create_list_and_retrieve(self, session_client, project, ids):
        created = create_intake_issue(session_client, project, ids)
        assert created["issue"]["name"] == "Ticket"
        url = (BASE + "/inbox-issues/").format(**ids)
        params = {
            "status": "-2",
            "priority": "high",
            "order_by": "-issue__created_at",
            "per_page": 10,
            "cursor": "10:0:0",
        }
        assert set(params) <= documented_query(BASE + "/inbox-issues/", "get")
        page = documented(session_client.get(url, params))
        assert [row["id"] for row in page["results"]] == [created["id"]]
        documented(session_client.get(f"{url}{created['issue']['id']}/"))

    def test_list_query_parameters(self):
        expected = {"status", "state", "priority", "labels", "assignees", "created_by", "created_at", "updated_at"}
        assert expected | {"order_by", "cursor", "per_page"} <= documented_query(BASE + "/intake-issues/", "get")

    def test_update_status_snooze_and_issue(self, session_client, project, ids):
        issue_id = create_intake_issue(session_client, project, ids)["issue"]["id"]
        route = BASE + "/inbox-issues/{pk}/"
        url, body = sent(route, "patch", {"status": 0, "snoozed_till": "2030-01-01"}, pk=issue_id, **ids)
        assert documented(session_client.patch(url, body, format="json"))["status"] == 0
        url, body = sent(route, "patch", {"issue": {"name": "Renamed"}}, pk=issue_id, **ids)
        assert documented(session_client.patch(url, body, format="json"))["issue"]["name"] == "Renamed"
        url, body = sent(route, "patch", {"status": 1}, pk=issue_id, **ids)
        assert documented(session_client.patch(url, body, format="json"))["status"] == 1

    def test_update_ignores_source_and_created_by(self, session_client, create_user, workspace, project, ids):
        issue_id = create_intake_issue(session_client, project, ids)["issue"]["id"]
        other = User.objects.create(email="other@plane.so", username="other")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
        url = (BASE + "/inbox-issues/{pk}/").format(pk=issue_id, **ids)
        body = {"status": -1, "source": "EMAIL", "created_by": str(other.id)}
        assert session_client.patch(url, body, format="json").status_code == 200
        intake_issue = IntakeIssue.objects.get(issue_id=issue_id)
        assert intake_issue.status == -1
        assert intake_issue.source == "IN_APP"
        assert intake_issue.created_by_id == create_user.id

    @pytest.mark.parametrize("skip", [True, False])
    def test_description_migration_skips_activity(self, session_client, project, ids, skip):
        issue_id = create_intake_issue(session_client, project, ids)["issue"]["id"]
        body = {"issue": {"description_html": "<p>Migrated</p>"}, **({"skip_activity": True} if skip else {})}
        url, body = sent(BASE + "/inbox-issues/{pk}/", "patch", body, pk=issue_id, **ids)
        with mock.patch("plane.app.views.intake.base.issue_activity") as activity:
            documented(session_client.patch(url, body, format="json"))
        updated = [call for call in activity.delay.call_args_list if call.kwargs["type"] == "issue.activity.updated"]
        assert bool(updated) is not skip

    def test_delete(self, session_client, project, ids):
        issue_id = create_intake_issue(session_client, project, ids)["issue"]["id"]
        response = session_client.delete((BASE + "/inbox-issues/{pk}/").format(pk=issue_id, **ids))
        assert response.status_code == 204


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestServiceDesk:
    def test_config(self, session_client, project, ids):
        body = {
            "mailbox_email": "desk@example.com",
            "is_enabled": False,
            "issue_type_id": None,
            "notify_mode": "NONE",
            "notify_user_ids": [],
        }
        url, body = sent(BASE + "/service-desk/", "post", body, **ids)
        assert documented(session_client.post(url, body, format="json"), 201)["mailbox_email"] == "desk@example.com"
        assert documented(session_client.post(url, body, format="json"))["notify_user_ids"] == []

    def test_email_thread_and_reply(self, session_client, workspace, project, ids):
        issue_id = create_intake_issue(session_client, project, ids)["issue"]["id"]
        IssueEmailThread.objects.create(
            issue_id=issue_id,
            project=project,
            workspace=workspace,
            mailbox_email="desk@example.com",
            conversation_id="c",
            creator_email="customer@example.com",
        )
        asset = FileAsset.objects.create(
            workspace=workspace,
            project=project,
            issue_id=issue_id,
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            attributes={"name": "a.txt", "type": "text/plain"},
            asset="a.txt",
            size=3,
            is_uploaded=True,
        )
        route = BASE + "/issues/{issue_id}/email-thread/"
        body = {"to_emails": ["a@example.com"], "cc_emails": []}
        url, body = sent(route, "patch", body, issue_id=issue_id, **ids)
        assert documented(session_client.patch(url, body, format="json"))["to_emails"] == ["a@example.com"]
        route = BASE + "/issues/{issue_id}/email-replies/"
        body = {"comment_html": "<p>Hi</p>", "attachment_asset_ids": [str(asset.id)]}
        url, body = sent(route, "post", body, issue_id=issue_id, **ids)
        reply = documented(session_client.post(url, body, format="json"), 201)
        assert reply["email_message"]["attachments"][0]["asset_id"] == str(asset.id)
