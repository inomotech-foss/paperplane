# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The user and workspace endpoints return what the OpenAPI schema documents."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from plane.db.models import (
    Account,
    APIToken,
    Issue,
    IssueActivity,
    IssueAssignee,
    Notification,
    Profile,
    State,
    User,
    WorkspaceMember,
)
from plane.tests.factories import ProjectFactory, ProjectMemberFactory
from plane.tests.openapi import assert_matches_schema
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def data(create_user, workspace):
    Profile.objects.get_or_create(user=create_user)
    project = ProjectFactory(workspace=workspace)
    ProjectMemberFactory(project=project, member=create_user, role=20)
    done = State.objects.create(name="Done", group="completed", project=project, workspace=workspace)
    State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    now = timezone.now()
    issues = [
        Issue.objects.create(
            name=name,
            project=project,
            workspace=workspace,
            type=link_starter_type(project),
            created_by=create_user,
            **fields,
        )
        for name, fields in [
            ("late", {"target_date": (now - timedelta(days=2)).date()}),
            ("soon", {"start_date": (now + timedelta(days=2)).date()}),
            ("done", {"state": done, "completed_at": now}),
        ]
    ]
    for issue in issues:
        IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=workspace)
        IssueActivity.objects.create(
            issue=issue, project=project, workspace=workspace, actor=create_user, verb="created", field="name"
        )
    Notification.objects.create(
        workspace=workspace,
        project=project,
        receiver=create_user,
        triggered_by=create_user,
        entity_identifier=issues[0].id,
        entity_name="issue",
        title="t",
        sender="in_app:issue_activities:mentioned",
    )
    Account.objects.create(user=create_user, provider="google", provider_account_id="a", access_token="t")
    return {"project": project, "issues": issues}


def ok(response, status=200, surface="internal"):
    assert response.status_code == status, response.content
    assert_matches_schema(response, surface)
    return response.json()


@pytest.mark.contract
@pytest.mark.django_db
class TestUserResponses:
    def test_me(self, session_client, data):
        ok(session_client.get("/api/users/me/"))
        ok(session_client.get("/api/users/me/settings/"))
        ok(session_client.get("/api/users/me/instance-admin/"))
        ok(session_client.get("/api/users/me/profile/"))
        ok(session_client.patch("/api/users/me/profile/", {"theme": {}}, format="json"))
        ok(session_client.patch("/api/users/me/onboard/", {"is_onboarded": True}, format="json"))
        ok(session_client.patch("/api/users/me/tour-completed/", {"is_tour_completed": True}, format="json"))

    def test_session(self, session_client, api_client, data):
        assert ok(session_client.get("/api/users/session/"))["user"]
        session_client.force_authenticate(user=None)
        assert ok(session_client.get("/api/users/session/")) == {"is_authenticated": False}

    def test_accounts(self, session_client, create_user, data):
        accounts = ok(session_client.get("/api/users/me/accounts/"))
        ok(session_client.get(f"/api/users/me/accounts/{accounts[0]['id']}/"))

    def test_activities(self, session_client, data):
        assert ok(session_client.get("/api/users/me/activities/"))["results"]

    def test_api_tokens(self, session_client, data):
        token = ok(session_client.post("/api/users/api-tokens/", {"label": "a"}, format="json"), status=201)
        assert token["token"]
        assert ok(session_client.get("/api/users/api-tokens/"))
        ok(session_client.get(f"/api/users/api-tokens/{token['id']}/"))
        ok(session_client.patch(f"/api/users/api-tokens/{token['id']}/", {"label": "b"}, format="json"))
        assert APIToken.objects.filter(label="b").exists()

    def test_connected_apps(self, session_client, data):
        ok(session_client.get("/api/users/connected-apps/"))

    def test_workspaces_and_graphs(self, session_client, workspace, data):
        assert ok(session_client.get("/api/users/me/workspaces/"))
        slug = workspace.slug
        assert ok(session_client.get(f"/api/users/me/workspaces/{slug}/activity-graph/"))
        month = timezone.now().month
        assert ok(session_client.get(f"/api/users/me/workspaces/{slug}/issues-completed-graph/", {"month": month}))
        dashboard = ok(session_client.get(f"/api/users/me/workspaces/{slug}/dashboard/", {"month": month}))
        assert dashboard["overdue_issues"] and dashboard["upcoming_issues"] and dashboard["completed_issues"]
        roles = ok(session_client.get(f"/api/users/me/workspaces/{slug}/project-roles/"))
        assert roles == {str(data["project"].id): 20}


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceUserResponses:
    def test_slug_check(self, session_client, workspace):
        assert ok(session_client.get("/api/workspace-slug-check/", {"slug": workspace.slug})) == {"status": False}

    def test_profile_pages(self, session_client, create_user, workspace, data):
        base = f"/api/workspaces/{workspace.slug}"
        assert ok(session_client.get(f"{base}/user-activity/{create_user.id}/"))["results"]
        assert ok(session_client.get(f"{base}/user-profile/{create_user.id}/"))["project_data"]
        stats = ok(session_client.get(f"{base}/user-stats/{create_user.id}/"))
        assert stats["state_distribution"] and stats["priority_distribution"]
        ok(session_client.get(f"{base}/user-properties/"))
        ok(session_client.patch(f"{base}/user-properties/", {"filters": {}}, format="json"))
        ok(session_client.get(f"{base}/workspace-members/me/"))

    def test_activity_export_is_csv(self, session_client, create_user, workspace, data):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/user-activity/{create_user.id}/export/",
            {"date": timezone.now().date().isoformat()},
            format="json",
        )
        assert response.status_code == 200
        assert response["Content-Type"] == "text/csv"

    def test_notifications(self, session_client, workspace, data):
        base = f"/api/workspaces/{workspace.slug}/users/notifications"
        assert ok(session_client.get(f"{base}/unread/"))["mention_unread_notifications_count"] == 1
        ok(session_client.post(f"{base}/mark-all-read/", {}, format="json"))


@pytest.fixture
def other(db, workspace):
    user = User.objects.create(email="other@plane.so", username="other")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


@pytest.mark.contract
@pytest.mark.django_db
class TestInstanceAdminResponses:
    def test_users(self, instance_admin_client, workspace, other):
        assert ok(instance_admin_client.get("/api/instances/users/"), surface="admin")["results"]
        detail = ok(instance_admin_client.get(f"/api/instances/users/{other.id}/"), surface="admin")
        assert detail["memberships"]
        with patch("plane.license.utils.user_lifecycle.user_deactivation_email"):
            ok(instance_admin_client.post(f"/api/instances/users/{other.id}/deactivate/"), surface="admin")
        ok(instance_admin_client.post(f"/api/instances/users/{other.id}/reactivate/"), surface="admin")

    def test_merge_preview(self, instance_admin_client, create_user, other):
        url = f"/api/instances/users/{create_user.id}/merge/preview/"
        merge = ok(instance_admin_client.post(url, {"source": str(other.id)}, format="json"), surface="admin")
        assert merge["relations"]

    def test_workspaces(self, instance_admin_client, workspace, other):
        assert ok(instance_admin_client.get("/api/instances/workspaces/"), surface="admin")["results"]
        ok(instance_admin_client.get(f"/api/instances/workspaces/{workspace.id}/"), surface="admin")
        url = f"/api/instances/workspaces/{workspace.id}/transfer-owner/"
        ok(instance_admin_client.post(url, {"owner": str(other.id)}, format="json"), surface="admin")
        ok(instance_admin_client.get("/api/instances/workspace-slug-check/", {"slug": "free"}), surface="admin")

    def test_admins(self, instance_admin_client):
        assert ok(instance_admin_client.get("/api/instances/admins/"), surface="admin")
        ok(instance_admin_client.get("/api/instances/admins/me/"), surface="admin")
        assert ok(instance_admin_client.get("/api/instances/admins/session/"), surface="admin")["user"]
