# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The user and workspace endpoints return what the OpenAPI schema documents."""

import json
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.utils import timezone

from plane.db.models import (
    Account,
    APIToken,
    Issue,
    IssueActivity,
    IssueAssignee,
    Notification,
    Profile,
    ProjectMemberInvite,
    State,
    User,
    UserRecentVisit,
    WorkspaceMember,
    WorkspaceMemberInvite,
)
from plane.tests.factories import ProjectFactory, ProjectMemberFactory
from plane.tests.openapi import assert_matches_schema, assert_no_content, documented_query, documented_request
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


def send(client, method, route, body, surface="internal", **params):
    """Send a JSON body after checking it against the documented request body of `route`."""
    documented_request(route, method, body, surface)
    return getattr(client, method)(route.format(**params), body, format="json")


@pytest.fixture
def celery_off():
    """The tests have no broker."""
    with patch("celery.app.task.Task.delay"), patch("celery.app.task.Task.apply_async"):
        yield


@pytest.mark.contract
@pytest.mark.django_db
class TestUserRequests:
    def test_api_token(self, session_client, data):
        body = {"label": "a", "description": "", "expired_at": None}
        token = ok(send(session_client, "post", "/api/users/api-tokens/", body), status=201)
        route = "/api/users/api-tokens/{pk}/"
        ok(send(session_client, "patch", route, {"label": "b"}, pk=token["id"]))

    def test_profile_and_onboarding(self, session_client, data):
        profile = ok(send(session_client, "patch", "/api/users/me/profile/", {"theme": {"theme": "dark"}}))
        assert set(profile["onboarding_step"]) == {
            "profile_complete",
            "workspace_create",
            "workspace_invite",
            "workspace_join",
        }
        ok(send(session_client, "patch", "/api/users/me/onboard/", {"is_onboarded": True}))
        ok(send(session_client, "patch", "/api/users/me/tour-completed/", {"is_tour_completed": True}))

    def test_email_change(self, session_client, create_user, data, celery_off):
        email = "new@plane.so"
        ok(send(session_client, "post", "/api/users/me/email/generate-code/", {"email": email}))
        code = json.loads(cache.get(f"magic_email_update_{create_user.id}_{email}"))["token"]
        assert (
            ok(send(session_client, "patch", "/api/users/me/email/", {"email": email, "code": code}))["email"] == email
        )

    def test_activity_export(self, session_client, create_user, workspace, data):
        route = "/api/workspaces/{slug}/user-activity/{user_id}/export/"
        body = {"date": timezone.now().date().isoformat()}
        response = send(session_client, "post", route, body, slug=workspace.slug, user_id=create_user.id)
        assert response.status_code == 200

    def test_join_projects(self, session_client, create_user, workspace, data):
        project = ProjectFactory(workspace=workspace)
        ProjectMemberInvite.objects.create(project=project, workspace=workspace, email=create_user.email, token="t")
        route = "/api/users/me/workspaces/{slug}/projects/invitations/"
        ok(send(session_client, "post", route, {"project_ids": [str(project.id)]}, slug=workspace.slug), status=201)


@pytest.fixture
def guest(db, workspace):
    user = User.objects.create(email="guest@plane.so", username="guest")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=5)
    return user


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceRequests:
    def test_create_and_slug_check(self, session_client, data):
        assert documented_query("/api/workspace-slug-check/", "get") == {"slug"}
        body = {"name": "Other", "slug": "other-ws", "company_role": "dev"}
        with patch("plane.app.views.workspace.base.workspace_seed.delay"):
            created = ok(send(session_client, "post", "/api/workspaces/", body), status=201)
        assert created["role"] == 20

    def test_invitations(self, session_client, create_user, workspace, data):
        base = "/api/workspaces/{slug}/invitations/"
        body = {"emails": [{"email": "invitee@plane.so", "role": 15}]}
        with patch("plane.app.views.workspace.invite.workspace_invitation.delay"):
            ok(send(session_client, "post", base, body, slug=workspace.slug))
        invite = WorkspaceMemberInvite.objects.get(email="invitee@plane.so")
        route = base + "{pk}/"
        ok(send(session_client, "patch", route, {"role": 5}, slug=workspace.slug, pk=invite.id))
        ok(session_client.get(f"/api/workspaces/{workspace.slug}/invitations/{invite.id}/join/"))

    def test_accept_invitations(self, session_client, create_user, workspace, data, celery_off):
        invite = WorkspaceMemberInvite.objects.create(workspace=workspace, email=create_user.email, token="a", role=15)
        route = "/api/workspaces/{slug}/invitations/{pk}/join/"
        ok(send(session_client, "post", route, {"token": "a", "accepted": True}, slug=workspace.slug, pk=invite.id))
        invite = WorkspaceMemberInvite.objects.create(workspace=workspace, email=create_user.email, token="b", role=15)
        route = "/api/users/me/workspaces/invitations/"
        assert_no_content(send(session_client, "post", route, {"invitations": [str(invite.id)]}))

    def test_members(self, session_client, api_client, workspace, other, guest, data):
        members = ok(session_client.get(f"/api/workspaces/{workspace.slug}/members/"))
        assert all("email" in row["member"] for row in members)
        row = next(row for row in members if row["member"]["id"] == str(other.id))
        ok(session_client.get(f"/api/workspaces/{workspace.slug}/members/{row['id']}/"))
        route = "/api/workspaces/{slug}/members/{pk}/"
        ok(send(session_client, "patch", route, {"role": 5}, slug=workspace.slug, pk=row["id"]))
        api_client.force_authenticate(user=guest)
        assert all(
            "email" not in row["member"] for row in ok(api_client.get(f"/api/workspaces/{workspace.slug}/members/"))
        )
        assert_no_content(api_client.post(f"/api/workspaces/{workspace.slug}/members/leave/"))

    def test_view_props_and_preferences(self, session_client, workspace, data):
        route = "/api/workspaces/{slug}/workspace-views/"
        assert_no_content(send(session_client, "post", route, {"view_props": {}}, slug=workspace.slug))
        route = "/api/workspaces/{slug}/user-properties/"
        ok(send(session_client, "patch", route, {"display_properties": {"key": True}}, slug=workspace.slug))
        preferences = ok(session_client.get(f"/api/workspaces/{workspace.slug}/sidebar-preferences/"))
        key = next(iter(preferences))
        route = "/api/workspaces/{slug}/sidebar-preferences/"
        ok(send(session_client, "patch", route, [{"key": key, "is_pinned": True}], slug=workspace.slug))
        assert ok(session_client.get(f"/api/workspaces/{workspace.slug}/home-preferences/"))

    def test_search(self, session_client, workspace, data):
        route = "/api/workspaces/{slug}/search/"
        assert {"search", "entities", "workspace_search", "project_id"} <= documented_query(route, "get")
        params = {"search": "late", "workspace_search": "true"}
        results = ok(session_client.get(route.format(slug=workspace.slug), params))["results"]
        assert results["issue"][0]["type_id"] == str(data["issues"][0].type_id)
        route = "/api/workspaces/{slug}/entity-search/"
        assert {"query", "query_type", "count", "project_id"} <= documented_query(route, "get")
        params = {"query": "", "query_type": "user_mention,project", "count": 2}
        assert set(ok(session_client.get(route.format(slug=workspace.slug), params))) == {"user_mention", "project"}

    def test_recent_visits(self, session_client, create_user, workspace, data):
        project = data["project"]
        for name, identifier in [("project", project.id), ("issue", data["issues"][0].id), ("cycle", project.id)]:
            UserRecentVisit.objects.create(
                workspace=workspace, user=create_user, entity_name=name, entity_identifier=identifier
            )
        route = "/api/workspaces/{slug}/recent-visits/"
        assert "entity_name" in documented_query(route, "get")
        visits = ok(session_client.get(route.format(slug=workspace.slug)))
        assert {visit["entity_name"] for visit in visits} == {"project", "issue"}
        issue = ok(session_client.get(route.format(slug=workspace.slug), {"entity_name": "issue"}))[0]
        assert issue["entity_data"]["assignees"] == [str(create_user.id)]

    def test_auth_bodies(self, session_client, create_user, data):
        documented_request("/auth/email-check/", "post", {"email": "a@plane.so"})
        documented_request("/auth/change-password/", "post", {"old_password": "a", "new_password": "b"})

    def test_notifications(self, session_client, workspace, data):
        base = f"/api/workspaces/{workspace.slug}/users/notifications/"
        issue = data["issues"][0]
        Notification.objects.filter(entity_identifier=issue.id).update(
            data={
                "issue": {
                    "id": str(issue.id),
                    "name": issue.name,
                    "identifier": "P",
                    "sequence_id": 1,
                    "state_name": None,
                    "state_group": None,
                },
                "issue_activity": {
                    "id": None,
                    "verb": "updated",
                    "field": None,
                    "actor": None,
                    "new_value": "",
                    "old_value": "",
                },
            }
        )
        flat = ok(session_client.get(base, {"mentioned": "true"}))
        assert flat[0]["data"]["issue"]
        paginated = ok(session_client.get(base, {"mentioned": "true", "per_page": 10, "cursor": "10:0:0"}))
        pk = paginated["results"][0]["id"]
        for action in ("read", "archive"):
            ok(session_client.post(f"{base}{pk}/{action}/"))
            ok(session_client.delete(f"{base}{pk}/{action}/"))
        route = "/api/workspaces/{slug}/users/notifications/{pk}/"
        ok(send(session_client, "patch", route, {"snoozed_till": None}, slug=workspace.slug, pk=pk))
        route = "/api/workspaces/{slug}/users/notifications/mark-all-read/"
        ok(
            send(
                session_client, "post", route, {"snoozed": False, "archived": False, "type": "all"}, slug=workspace.slug
            )
        )


@pytest.mark.contract
@pytest.mark.django_db
class TestInstanceAdminRequests:
    def test_user_list_filters(self, instance_admin_client, other):
        documented = documented_query("/api/instances/users/", "get", "admin")
        assert {"search", "is_active", "is_bot", "include_deleted"} <= documented
        params = {"search": "other", "is_active": "true", "is_bot": "false", "include_deleted": "true"}
        assert ok(instance_admin_client.get("/api/instances/users/", params), surface="admin")["results"]

    def test_merge_and_transfer(self, instance_admin_client, create_user, workspace, other):
        route = "/api/instances/users/{pk}/merge/preview/"
        body = {"source": str(other.id), "keep_source_email": False}
        ok(send(instance_admin_client, "post", route, body, "admin", pk=create_user.id), surface="admin")
        route = "/api/instances/workspaces/{pk}/transfer-owner/"
        body = {"owner": str(other.id)}
        ok(send(instance_admin_client, "post", route, body, "admin", pk=workspace.id), surface="admin")
        assert documented_query("/api/instances/workspace-slug-check/", "get", "admin") == {"slug"}
