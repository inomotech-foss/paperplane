# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The remaining endpoints return what the OpenAPI schema documents."""

from datetime import date
from unittest.mock import patch

from django.utils import timezone

import pytest

from plane.db.models import (
    AutomationRun,
    Cycle,
    Dashboard,
    DashboardWidget,
    DeployBoard,
    FileAsset,
    Issue,
    IssueComment,
    IssueEmailThread,
    Label,
    Notification,
    Page,
    PageComment,
    ProjectMember,
    ProjectPage,
    State,
    WorkspaceMemberInvite,
)
from plane.license.models import Instance, InstanceConfiguration
from plane.license.utils.encryption import encrypt_data
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="RS")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture
def issue(create_user, workspace, project):
    state = State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    return Issue.objects.create(
        name="first",
        project=project,
        workspace=workspace,
        type=link_starter_type(project),
        state=state,
        created_by=create_user,
        start_date=date(2026, 1, 1),
    )


def base(workspace, path=""):
    return f"/api/workspaces/{workspace.slug}/{path}"


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestWorkspaceExtras:
    def test_favorites(self, session_client, workspace, project):
        body = {"entity_type": "project", "entity_identifier": str(project.id), "project_id": str(project.id)}
        favorite = documented(session_client.post(base(workspace, "user-favorites/"), body, format="json"))
        assert documented(session_client.get(base(workspace, "user-favorites/")))
        documented(
            session_client.patch(base(workspace, f"user-favorites/{favorite['id']}/"), {"name": "x"}, format="json")
        )
        documented(session_client.get(base(workspace, f"user-favorites/{favorite['id']}/group/")))

    @patch("plane.app.serializers.webhook.validate_url")
    def test_webhooks(self, _validate_url, session_client, workspace):
        hook = documented(
            session_client.post(base(workspace, "webhooks/"), {"url": "https://hooks.example/x"}, format="json"), 201
        )
        assert documented(session_client.get(base(workspace, "webhooks/")))
        documented(session_client.get(base(workspace, f"webhooks/{hook['id']}/")))
        documented(
            session_client.patch(base(workspace, f"webhooks/{hook['id']}/"), {"is_active": False}, format="json")
        )
        documented(session_client.post(base(workspace, f"webhooks/{hook['id']}/regenerate/")))
        documented(session_client.get(base(workspace, f"webhook-logs/{hook['id']}/")))

    def test_estimates(self, session_client, workspace, project):
        url = base(workspace, f"projects/{project.id}/estimates/")
        body = {"estimate": {"name": "Points", "type": "points"}, "estimate_points": [{"key": 1, "value": "1"}]}
        estimate = documented(session_client.post(url, body, format="json"))
        assert documented(session_client.get(url))
        documented(session_client.get(f"{url}{estimate['id']}/"))
        point = documented(
            session_client.post(f"{url}{estimate['id']}/estimate-points/", {"key": 2, "value": "2"}, format="json")
        )
        documented(
            session_client.patch(f"{url}{estimate['id']}/estimate-points/{point['id']}/", {"value": "3"}, format="json")
        )
        project.estimate_id = estimate["id"]
        project.save()
        assert documented(session_client.get(base(workspace, f"projects/{project.id}/project-estimates/")))
        assert documented(session_client.get(base(workspace, "estimates/")))
        documented(session_client.delete(f"{url}{estimate['id']}/estimate-points/{point['id']}/"))

    def test_invitation_join(self, session_client, create_user, workspace):
        invite = WorkspaceMemberInvite.objects.create(workspace=workspace, email=create_user.email, token="t", role=15)
        documented(session_client.get(base(workspace, f"invitations/{invite.id}/join/")))
        body = {"token": "t", "accepted": False}
        documented(session_client.post(base(workspace, f"invitations/{invite.id}/join/"), body, format="json"))

    def test_search(self, session_client, workspace, project, issue):
        results = documented(session_client.get(base(workspace, "search/"), {"search": "fir"}))["results"]
        assert results["issue"]
        mention = {"query_type": "user_mention,issue,project,cycle,module,page", "query": ""}
        assert documented(session_client.get(base(workspace, "entity-search/"), mention))["user_mention"]
        in_project = {**mention, "project_id": str(project.id)}
        assert documented(session_client.get(base(workspace, "entity-search/"), in_project))["issue"]
        assert documented(session_client.get("/api/timezones/"))["timezones"]

    def test_notifications(self, session_client, create_user, workspace, project, issue):
        notification = Notification.objects.create(
            workspace=workspace,
            project=project,
            receiver=create_user,
            entity_identifier=issue.id,
            entity_name="issue",
            title="t",
        )
        url = base(workspace, "users/notifications/")
        assert documented(session_client.get(url))
        assert documented(session_client.get(url, {"per_page": 10, "cursor": "10:0:0"}))["results"]
        documented(session_client.post(f"{url}{notification.id}/read/"))
        documented(session_client.delete(f"{url}{notification.id}/read/"))
        documented(session_client.post(f"{url}{notification.id}/archive/"))
        documented(session_client.delete(f"{url}{notification.id}/archive/"))


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestAnalyticsDashboardsAutomations:
    def test_analytics(self, session_client, workspace, project, issue):
        assert documented(session_client.get(base(workspace, "advance-analytics/")))["total_work_items"]
        assert documented(session_client.get(base(workspace, "advance-analytics/"), {"tab": "work-items"}))
        assert documented(session_client.get(base(workspace, "advance-analytics-stats/")))
        assert documented(session_client.get(base(workspace, "advance-analytics-charts/")))
        assert documented(session_client.get(base(workspace, "advance-analytics-charts/"), {"type": "work-items"}))[
            "data"
        ]
        custom = {"type": "custom-work-items", "x_axis": "PRIORITY", "group_by": "STATES"}
        assert documented(session_client.get(base(workspace, "advance-analytics-charts/"), custom))["data"]
        project_base = base(workspace, f"projects/{project.id}/")
        assert documented(session_client.get(f"{project_base}advance-analytics/"))
        assert documented(session_client.get(f"{project_base}advance-analytics-stats/"))
        assert documented(session_client.get(f"{project_base}advance-analytics-charts/", {"type": "work-items"}))
        assert documented(session_client.get(f"{project_base}advance-analytics-charts/", custom))
        axes = {"x_axis": "priority", "y_axis": "issue_count"}
        assert documented(session_client.get(base(workspace, "analytics/"), axes))["distribution"]
        segmented = {"x_axis": "state_id", "y_axis": "issue_count", "segment": "priority"}
        assert documented(session_client.get(base(workspace, "analytics/"), segmented))["extras"]["state_details"]
        assert documented(session_client.get(base(workspace, "default-analytics/")))["total_issues"]
        documented(session_client.post(base(workspace, "export-analytics/"), axes, format="json"))

    def test_dashboards(self, session_client, create_user, workspace, issue):
        dashboard = Dashboard.objects.create(workspace=workspace, name="D", owned_by=create_user)
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            workspace=workspace,
            title="By priority",
            chart_type="bar",
            metric={"function": "count"},
            dimension={"field": "priority"},
        )
        assert documented(session_client.get(base(workspace, f"dashboards/{dashboard.id}/")))["widgets"]
        assert documented(session_client.get(base(workspace, f"dashboards/{dashboard.id}/widgets/{widget.id}/data/")))[
            "data"
        ]
        body = {"chart_type": "number", "metric": {"function": "count"}}
        documented(session_client.post(base(workspace, "dashboards/preview/"), body, format="json"))
        assert documented(session_client.get(base(workspace, "dashboards/options/")))["chart_types"]

    def test_automations(self, session_client, workspace, project):
        assert documented(session_client.get(base(workspace, "automation-metadata/")))["triggers"]
        for url in (base(workspace, f"projects/{project.id}/automations/"), base(workspace, "automations/")):
            body = {"name": "A", "trigger_type": "work_item.created", "applies_to_all_projects": True}
            automation = documented(session_client.post(url, body, format="json"), 201)
            assert documented(session_client.get(url))
            documented(session_client.get(f"{url}{automation['id']}/"))
            documented(session_client.patch(f"{url}{automation['id']}/", {"name": "B"}, format="json"))
            actions = f"{url}{automation['id']}/actions/"
            action = documented(
                session_client.post(actions, {"action_type": "archive_work_item", "config": {}}, format="json"), 201
            )
            assert documented(session_client.get(actions))
            documented(session_client.patch(f"{actions}{action['id']}/", {"config": {}}, format="json"))
            AutomationRun.objects.create(
                workspace=workspace,
                project=project,
                automation_id=automation["id"],
                status="success",
                started_at=timezone.now(),
            )
            assert documented(session_client.get(f"{url}{automation['id']}/runs/"))["results"]
            enable = {"is_enabled": True}
            documented(session_client.patch(f"{url}{automation['id']}/", enable, format="json"))
            documented(session_client.post(f"{url}{automation['id']}/runs/"), 202)


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestServiceDeskAndVersions:
    def test_email_thread(self, session_client, create_user, workspace, project, issue):
        IssueEmailThread.objects.create(
            issue=issue,
            project=project,
            workspace=workspace,
            mailbox_email="desk@example.com",
            conversation_id="c",
            creator_email="customer@example.com",
        )
        url = base(workspace, f"projects/{project.id}/issues/{issue.id}/email-thread/")
        documented(session_client.get(url))
        documented(session_client.patch(url, {"notify_mode": "all"}, format="json"))

    def test_service_desk(self, session_client, workspace, project):
        url = base(workspace, f"projects/{project.id}/service-desk/")
        documented(session_client.post(url, {"is_enabled": False}, format="json"), 201)
        documented(session_client.get(url))

    def test_intake_versions(self, session_client, create_user, workspace, project, issue):
        from plane.db.models import IssueDescriptionVersion

        IssueDescriptionVersion.objects.create(issue=issue, project=project, workspace=workspace, owned_by=create_user)
        url = base(workspace, f"projects/{project.id}/intake-work-items/{issue.id}/description-versions/")
        versions = documented(session_client.get(url))
        documented(session_client.get(f"{url}{versions['results'][0]['id']}/"))


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestPublicAndAssets:
    def test_public_board(self, api_client, session_client, create_user, workspace, project, issue):
        board = DeployBoard.objects.create(
            workspace=workspace, project=project, entity_name="project", entity_identifier=project.id
        )
        Label.objects.create(name="bug", project=project, workspace=workspace)
        Cycle.objects.create(name="C", project=project, workspace=workspace, owned_by=create_user)
        IssueComment.objects.create(issue=issue, project=project, workspace=workspace, actor=create_user)
        anchor = f"/api/public/anchor/{board.anchor}/"
        for path in ("meta/", "settings/", "states/", "labels/", "cycles/", "modules/", "members/"):
            documented(api_client.get(f"{anchor}{path}"))
        assert documented(api_client.get(f"{anchor}issues/"))["results"]
        documented(api_client.get(f"{anchor}issues/{issue.id}/"))
        documented(
            session_client.get(
                base(workspace, f"projects/{project.id}/anchor/").replace("/api/workspaces/", "/api/public/workspaces/")
            )
        )

    def test_asset_check(self, session_client, create_user, workspace):
        asset = FileAsset.objects.create(
            workspace=workspace, asset="w/a.png", attributes={}, entity_type="USER_AVATAR", created_by=create_user
        )
        assert documented(session_client.get(f"/api/assets/v2/workspaces/{workspace.slug}/check/{asset.id}/"))["exists"]
        lookup = f"/api/workspaces/file-assets/{workspace.id}/missing.png/"
        assert documented(session_client.get(lookup))["status"] is False


@pytest.mark.contract
@pytest.mark.django_db
class TestAuthAndAdmin:
    def test_auth(self, api_client, instance_admin_client):
        Instance.objects.update(is_setup_done=True)
        documented(api_client.get("/auth/get-csrf-token/"))
        documented(api_client.post("/auth/email-check/", {"email": "nobody@plane.so"}, format="json"))
        documented(api_client.post("/auth/spaces/email-check/", {"email": "nobody@plane.so"}, format="json"))

    def test_admin(self, instance_admin_client):
        documented(instance_admin_client.get("/api/instances/"), surface="admin")
        InstanceConfiguration.objects.bulk_create(
            [
                InstanceConfiguration(key="EMAIL_HOST", value="smtp.example", category="SMTP"),
                InstanceConfiguration(
                    key="EMAIL_HOST_PASSWORD", value=encrypt_data("s"), category="SMTP", is_encrypted=True
                ),
                InstanceConfiguration(key="EMAIL_PORT", value=None, category="SMTP"),
            ]
        )
        with patch.dict("os.environ", {"PROVISION_MANAGED_KEYS": "EMAIL_HOST"}):
            configs = documented(instance_admin_client.get("/api/instances/configurations/"), surface="admin")
        assert {c["key"]: c["is_managed"] for c in configs} == {
            "EMAIL_HOST": True,
            "EMAIL_HOST_PASSWORD": False,
            "EMAIL_PORT": False,
        }
        app = documented(
            instance_admin_client.post(
                "/api/instances/oauth-applications/",
                {"name": "MCP", "redirect_uris": "https://mcp.example/callback"},
                format="json",
            ),
            201,
            surface="admin",
        )
        assert documented(instance_admin_client.get("/api/instances/oauth-applications/"), surface="admin")
        documented(
            instance_admin_client.patch(
                f"/api/instances/oauth-applications/{app['id']}/", {"name": "M"}, format="json"
            ),
            surface="admin",
        )


@pytest.mark.contract
@pytest.mark.django_db
class TestPublicV1:
    def test_project_summary(self, api_key_client, workspace, project, issue):
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/summary/"
        summary = documented(api_key_client.get(url, {"fields": "issues,states,unknown"}), surface="v1")
        assert summary["counts"] == {"issues": 1, "states": 1}
        everything = documented(api_key_client.get(url), surface="v1")["counts"]
        assert set(everything) == {"members", "states", "labels", "cycles", "modules", "issues", "intakes", "pages"}

    def test_page_comment_resolve(self, api_key_client, create_user, workspace, project):
        page = Page.objects.create(name="P", workspace=workspace, owned_by=create_user, access=Page.PUBLIC_ACCESS)
        ProjectPage.objects.create(workspace=workspace, project=project, page=page, created_by=create_user)
        comment = PageComment.objects.create(page=page, comment_html="<p>c</p>", anchor_id="a1", actor=create_user)
        project_url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}"
        url = f"{project_url}/pages/{page.id}/comments/{comment.id}/resolve/"
        assert documented(api_key_client.post(url), surface="v1")["is_resolved"] is True
        assert documented(api_key_client.delete(url), surface="v1")["is_resolved"] is False
