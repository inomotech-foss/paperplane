# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The project endpoints return what the OpenAPI schema documents."""

import pytest

from plane.db.models import Label, ProjectIdentifier, ProjectMember, ProjectMemberInvite, User, WorkspaceMember
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query, documented_request
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="PRJ")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    link_starter_type(project)
    ProjectIdentifier.objects.create(name="PRJ", project=project, workspace=workspace)
    Label.objects.create(name="bug", project=project, workspace=workspace)
    return project


@pytest.fixture
def guest(workspace, project):
    user = User.objects.create(email="guest@plane.so", username="guest")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=5)
    return ProjectMember.objects.create(project=project, member=user, role=5)


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestProjectResponses:
    def test_projects(self, session_client, workspace, project):
        base = f"/api/workspaces/{workspace.slug}/projects"
        assert documented(session_client.get(f"{base}/"))
        assert documented(session_client.get(f"{base}/details/"))
        assert documented(session_client.get(f"{base}/details/", {"per_page": 10, "cursor": "10:0:0"}))["results"]
        documented(session_client.get(f"{base}/{project.id}/"))
        documented(session_client.patch(f"{base}/{project.id}/", {"name": "Renamed"}, format="json"))
        created = {"name": "New", "identifier": "NEW"}
        documented(session_client.post(f"{base}/", created, format="json"), status=201)

    def test_project_settings(self, session_client, create_user, workspace, project):
        base = f"/api/workspaces/{workspace.slug}/projects/{project.id}"
        documented(session_client.get(f"{base}/user-properties/"))
        documented(session_client.patch(f"{base}/user-properties/", {"filters": {}}, format="json"))
        documented(session_client.get(f"{base}/project-members/me/"))
        documented(session_client.get(f"{base}/preferences/member/{create_user.id}/"))
        patch = {"pages": {"block_display": True}}
        documented(session_client.patch(f"{base}/preferences/member/{create_user.id}/", patch, format="json"))
        documented(session_client.post(f"{base}/issue-sequence/", {"start": 100}, format="json"))
        assert "id" not in documented(session_client.get(f"{base}/project-deploy-boards/"))
        documented(session_client.post(f"{base}/project-deploy-boards/", {}, format="json"))
        assert documented(session_client.get(f"{base}/project-deploy-boards/"))["id"]
        documented(session_client.post(f"{base}/archive/"))

    def test_members(self, session_client, workspace, project, guest):
        base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/members"
        documented(session_client.get(f"{base}/"))
        own = ProjectMember.objects.get(project=project, member__email="test@plane.so")
        assert "preferences" in documented(session_client.get(f"{base}/{own.id}/"))
        assert "preferences" not in documented(session_client.get(f"{base}/{guest.id}/"))
        assert "preferences" not in documented(session_client.patch(f"{base}/{guest.id}/", {"role": 5}, format="json"))
        session_client.force_authenticate(user=guest.member)
        assert "original_role" in documented(session_client.get(f"{base}/{own.id}/"))

    def test_member_create(self, session_client, workspace, project):
        user = User.objects.create(email="new@plane.so", username="new")
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
        body = {"members": [{"member_id": str(user.id), "role": 15}]}
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/members/"
        assert documented(session_client.post(url, body, format="json"), status=201)

    def test_join(self, session_client, create_user, workspace, project):
        base = f"/api/workspaces/{workspace.slug}/projects/{project.id}"
        invite = ProjectMemberInvite.objects.create(
            project=project, workspace=workspace, email=create_user.email, token="t", role=15
        )
        documented(session_client.get(f"{base}/join/{invite.id}/"))
        response = session_client.post(f"{base}/join/{invite.id}/", {"token": "t", "accepted": True}, format="json")
        documented(response)

    def test_links(self, session_client, workspace, project):
        base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/links"
        link = documented(
            session_client.post(f"{base}/", {"title": "a", "url": "https://a.example"}, format="json"), 201
        )
        assert documented(session_client.get(f"{base}/"))
        documented(session_client.patch(f"{base}/{link['id']}/", {"title": "b"}, format="json"))
        documented(session_client.post(f"{base}/reorder/", {"link_ids": [link["id"]]}, format="json"))
        assert documented(session_client.get(f"/api/workspaces/{workspace.slug}/project-links/"))

    def test_workspace_level(self, session_client, workspace, project):
        base = f"/api/workspaces/{workspace.slug}"
        assert documented(session_client.get(f"{base}/project-identifiers/", {"name": "prj"}))["exists"] == 1
        stats = documented(session_client.get(f"{base}/project-stats/"))
        assert "total_issues" in stats[0]
        assert (
            "total_members"
            not in documented(session_client.get(f"{base}/project-stats/", {"fields": "total_issues"}))[0]
        )
        assert documented(session_client.get(f"{base}/labels/"))
        body = {"label_data": [{"name": "x"}]}
        documented(session_client.post(f"{base}/projects/{project.id}/bulk-create-labels/", body, format="json"), 201)


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestProjectRequests:
    def test_project_bodies(self, session_client, workspace, project):
        body = {"name": "Req", "identifier": "REQ"}
        url, body = sent("/api/workspaces/{slug}/projects/", "post", body, slug=workspace.slug)
        documented(session_client.post(url, body, format="json"), status=201)
        route = "/api/workspaces/{slug}/projects/{pk}/"
        url, body = sent(route, "patch", {"name": "Renamed"}, slug=workspace.slug, pk=project.id)
        documented(session_client.patch(url, body, format="json"))

    def test_links_and_members(self, session_client, workspace, project):
        base = "/api/workspaces/{slug}/projects/{project_id}"
        ids = {"slug": workspace.slug, "project_id": project.id}
        url, body = sent(base + "/links/", "post", {"title": "a", "url": "https://a.example"}, **ids)
        link = documented(session_client.post(url, body, format="json"), 201)
        url, body = sent(base + "/links/reorder/", "post", {"link_ids": [link["id"]]}, **ids)
        documented(session_client.post(url, body, format="json"))
        user = User.objects.create(email="req@plane.so", username="req")
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
        members = {"members": [{"member_id": str(user.id), "role": 15}]}
        url, body = sent(base + "/members/", "post", members, **ids)
        documented(session_client.post(url, body, format="json"), 201)

    def test_settings_bodies(self, session_client, workspace, project):
        base = "/api/workspaces/{slug}/projects/{project_id}"
        ids = {"slug": workspace.slug, "project_id": project.id}
        url, body = sent(base + "/issue-sequence/", "post", {"start": 100}, **ids)
        documented(session_client.post(url, body, format="json"))
        board = {"is_comments_enabled": True, "views": {"list": True, "kanban": False}}
        url, body = sent(base + "/project-deploy-boards/", "post", board, **ids)
        assert documented(session_client.post(url, body, format="json"))["view_props"] == board["views"]
        route = "/api/workspaces/{slug}/user-favorite-projects/"
        url, body = sent(route, "post", {"project": str(project.id)}, slug=workspace.slug)
        assert session_client.post(url, body, format="json").status_code == 204

    def test_join(self, session_client, create_user, workspace, project):
        invite = ProjectMemberInvite.objects.create(
            project=project, workspace=workspace, email=create_user.email, token="t", role=15
        )
        route = "/api/workspaces/{slug}/projects/{project_id}/join/{pk}/"
        ids = {"slug": workspace.slug, "project_id": project.id, "pk": invite.id}
        url, body = sent(route, "post", {"token": "t", "accepted": True}, **ids)
        documented(session_client.post(url, body, format="json"))

    def test_export(self, session_client, workspace, project):
        route = "/api/workspaces/{slug}/export-issues/"
        url, body = sent(route, "post", {"provider": "csv", "multiple": False}, slug=workspace.slug)
        documented(session_client.post(url, body, format="json"))
        assert {"cursor", "per_page"} <= documented_query(route, "get")
        assert documented(session_client.get(url, {"per_page": 10, "cursor": "10:0:0"}))["results"]

    def test_query_parameters(self, session_client, workspace, project):
        assert documented_query("/api/workspaces/{slug}/project-identifiers/", "get") == {"name"}
        assert {"fields", "project_ids"} <= documented_query("/api/workspaces/{slug}/project-stats/", "get")
        route = "/api/workspaces/{slug}/projects/{project_id}/search-issues/"
        assert {"search", "workspace_search", "issue_id", "parent", "limit"} <= documented_query(route, "get")
        url = route.format(slug=workspace.slug, project_id=project.id)
        documented(session_client.get(url, {"search": "x", "workspace_search": "false", "limit": 5}))
