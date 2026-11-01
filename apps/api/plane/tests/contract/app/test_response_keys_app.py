# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The keys of the list and detail responses whose views used to pass a `fields` argument."""

import pytest
from rest_framework.test import APIClient

from plane.db.models import Issue, IssueView, Module, ProjectMember, User, Webhook, WorkspaceMember
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.utils.issue_type import link_starter_type

WORKSPACE_MEMBER = {
    "company_role",
    "created_at",
    "created_by",
    "default_props",
    "deleted_at",
    "explored_features",
    "getting_started_checklist",
    "id",
    "is_active",
    "issue_props",
    "member",
    "pql_dialect",
    "role",
    "tips",
    "updated_at",
    "updated_by",
    "view_props",
    "workspace",
}
USER_FOR_ADMIN = {
    "avatar",
    "avatar_url",
    "display_name",
    "email",
    "first_name",
    "id",
    "is_bot",
    "last_login_medium",
    "last_name",
}
USER_FOR_GUEST = {"avatar", "avatar_url", "display_name", "first_name", "id", "is_bot", "last_name"}
PROJECT_MEMBER_ROLE = {"created_at", "id", "member", "original_role", "project", "role"}
PROJECT_MEMBER_ADMIN = {
    "comment",
    "created_at",
    "created_by",
    "default_props",
    "deleted_at",
    "id",
    "is_active",
    "member",
    "preferences",
    "project",
    "role",
    "sort_order",
    "updated_at",
    "updated_by",
    "view_props",
    "workspace",
}
PROJECT_DETAIL = {
    "anchor",
    "archive_in",
    "archived_at",
    "close_in",
    "cover_image",
    "cover_image_asset",
    "cover_image_url",
    "created_at",
    "created_by",
    "cycle_view",
    "default_assignee",
    "default_state",
    "deleted_at",
    "description",
    "description_html",
    "description_text",
    "emoji",
    "estimate",
    "external_id",
    "external_source",
    "guest_view_all_features",
    "icon_prop",
    "id",
    "identifier",
    "inbox_view",
    "intake_view",
    "is_favorite",
    "is_issue_type_enabled",
    "is_time_tracking_enabled",
    "issue_view",
    "issue_views_view",
    "logo_props",
    "member_role",
    "members",
    "module_view",
    "name",
    "network",
    "next_work_item_sequence",
    "page_view",
    "project_lead",
    "sort_order",
    "timezone",
    "updated_at",
    "updated_by",
    "workspace",
}
WORKSPACE_VIEW = {
    "access",
    "archived_at",
    "created_at",
    "created_by",
    "deleted_at",
    "description",
    "display_filters",
    "display_properties",
    "filters",
    "id",
    "is_locked",
    "logo_props",
    "name",
    "owned_by",
    "project",
    "query",
    "rich_filters",
    "sort_order",
    "updated_at",
    "updated_by",
    "workspace",
}
PROJECT_VIEW = WORKSPACE_VIEW | {"is_favorite"}
MODULE = {
    "backlog_issues",
    "cancelled_issues",
    "completed_estimate_points",
    "completed_issues",
    "created_at",
    "description",
    "description_html",
    "description_text",
    "external_id",
    "external_source",
    "id",
    "is_favorite",
    "lead_id",
    "logo_props",
    "member_ids",
    "name",
    "project_id",
    "sort_order",
    "start_date",
    "started_issues",
    "status",
    "target_date",
    "total_estimate_points",
    "total_issues",
    "unstarted_issues",
    "updated_at",
    "view_props",
    "workspace_id",
}
WORK_ITEM_DETAIL = {
    "archived_at",
    "assignee_ids",
    "attachment_count",
    "completed_at",
    "created_at",
    "created_by",
    "cycle_id",
    "estimate_point",
    "id",
    "is_draft",
    "label_ids",
    "link_count",
    "module_ids",
    "name",
    "parent_id",
    "priority",
    "project_id",
    "sequence_id",
    "sort_order",
    "start_date",
    "state_id",
    "sub_issues_count",
    "target_date",
    "type_id",
    "updated_at",
    "updated_by",
}
WORK_ITEM_SNAPSHOT = WORK_ITEM_DETAIL | {"deleted_at"}
USER_WORKSPACE = {
    "background_color",
    "created_at",
    "created_by",
    "deleted_at",
    "id",
    "logo",
    "logo_asset",
    "logo_url",
    "name",
    "organization_size",
    "owner",
    "pql_dialect",
    "role",
    "slug",
    "timezone",
    "total_members",
    "updated_at",
    "updated_by",
}
WEBHOOK = {
    "created_at",
    "created_by",
    "cycle",
    "deleted_at",
    "id",
    "is_active",
    "is_internal",
    "issue",
    "issue_comment",
    "module",
    "project",
    "updated_at",
    "updated_by",
    "url",
    "version",
    "workspace",
}


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="RK")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture
def guest_client(workspace, project):
    user = User.objects.create(email="guest@plane.so", username="guest", first_name="Guest", last_name="User")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=5)
    ProjectMember.objects.create(project=project, member=user, role=5)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def records(create_user, workspace, project):
    issue = Issue.objects.create(name="Item", project=project, workspace=workspace, type=link_starter_type(project))
    Module.objects.create(name="Mod", project=project, workspace=workspace)
    IssueView.objects.create(name="Project view", project=project, workspace=workspace, owned_by=create_user)
    IssueView.objects.create(name="Workspace view", workspace=workspace, owned_by=create_user)
    webhook = Webhook.objects.create(workspace=workspace, url="https://example.com/hook")
    return {"issue": issue, "webhook": webhook}


def row(body):
    """A detail body, or the first row of a list or paginated page."""
    if isinstance(body, dict) and "results" in body:
        body = body["results"]
    if isinstance(body, list):
        assert body
        body = body[0]
    return body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestResponseKeys:
    def test_workspace_members(self, session_client, guest_client, create_user, workspace):
        base = f"/api/workspaces/{workspace.slug}/members/"
        admin = WorkspaceMember.objects.get(workspace=workspace, member=create_user)
        for client, user in [(session_client, USER_FOR_ADMIN), (guest_client, USER_FOR_GUEST)]:
            for url in [base, f"{base}{admin.id}/"]:
                member = row(documented(client.get(url)))
                assert set(member) == WORKSPACE_MEMBER
                assert set(member["member"]) == user

    def test_project_members(self, session_client, guest_client, create_user, workspace, project):
        base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/members/"
        own = ProjectMember.objects.get(project=project, member=create_user)
        assert set(row(documented(session_client.get(base)))) == PROJECT_MEMBER_ROLE
        admin_view = documented(session_client.get(f"{base}{own.id}/"))
        assert set(admin_view) == PROJECT_MEMBER_ADMIN
        assert set(admin_view["member"]) == USER_FOR_ADMIN
        assert set(documented(guest_client.get(f"{base}{own.id}/"))) == PROJECT_MEMBER_ROLE

    @pytest.mark.parametrize("params", [{}, {"fields": "id"}])
    def test_lists(self, session_client, workspace, project, records, params):
        ws = f"/api/workspaces/{workspace.slug}"
        pr = f"{ws}/projects/{project.id}"
        expected = {
            f"{ws}/projects/details/": PROJECT_DETAIL,
            f"{ws}/views/": WORKSPACE_VIEW,
            f"{pr}/views/": PROJECT_VIEW,
            f"{pr}/modules/": MODULE,
            f"{pr}/issues-detail/": WORK_ITEM_DETAIL,
            "/api/users/me/workspaces/": USER_WORKSPACE,
            f"{ws}/webhooks/": WEBHOOK,
            f"{ws}/webhooks/{records['webhook'].id}/": WEBHOOK,
        }
        for url, keys in expected.items():
            assert set(row(documented(session_client.get(url, params)))) == keys, url

    @pytest.mark.parametrize("params", [{}, {"fields": "id"}])
    def test_work_items_by_id(self, session_client, workspace, project, records, params):
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/list/"
        query = {"issues": str(records["issue"].id), **params}
        assert set(row(documented(session_client.get(url, query)))) == WORK_ITEM_SNAPSHOT
        response = session_client.get(url, {**query, "expand": "state"})
        assert response.status_code == 200
        assert set(row(response.json())) == WORK_ITEM_DETAIL | {"state"}
