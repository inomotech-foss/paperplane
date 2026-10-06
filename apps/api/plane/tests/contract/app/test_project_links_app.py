# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Project, ProjectLink, ProjectMember, User, WorkspaceMember

ADMIN, MEMBER, GUEST = 20, 15, 5


def _links_url(slug, project_id, suffix=""):
    return f"/api/workspaces/{slug}/projects/{project_id}/links/{suffix}"


def _client_for(workspace, project, email, *, project_role=None, ws_role=MEMBER):
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=ws_role)
    if project_role is not None:
        ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=project_role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Links", identifier="LNK", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def clients(workspace, project):
    return {
        "admin": _client_for(workspace, project, "admin@plane.so", project_role=ADMIN),
        "member": _client_for(workspace, project, "member@plane.so", project_role=MEMBER),
        "guest": _client_for(workspace, project, "guest@plane.so", project_role=GUEST, ws_role=GUEST),
        "non_member": _client_for(workspace, project, "outsider@plane.so"),
    }


@pytest.fixture
def link(project):
    return ProjectLink.objects.create(project=project, title="Wiki", url="https://example.com/wiki", sort_order=1000)


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectLinkPermissions:
    @pytest.mark.parametrize(
        "role,expected",
        [("admin", 200), ("member", 200), ("guest", 200), ("non_member", 403)],
    )
    def test_list(self, workspace, project, link, clients, role, expected):
        response = clients[role].get(_links_url(workspace.slug, project.id))

        assert response.status_code == expected
        if expected == 200:
            assert [item["id"] for item in response.json()] == [str(link.id)]

    @pytest.mark.parametrize(
        "role,expected",
        [("admin", 201), ("member", 403), ("guest", 403), ("non_member", 403)],
    )
    def test_create(self, workspace, project, clients, role, expected):
        response = clients[role].post(
            _links_url(workspace.slug, project.id), {"title": "Repo", "url": "https://github.com/x/y"}, format="json"
        )

        assert response.status_code == expected
        assert ProjectLink.objects.filter(project=project).count() == (1 if expected == 201 else 0)

    @pytest.mark.parametrize(
        "role,expected",
        [("admin", 200), ("member", 403), ("guest", 403), ("non_member", 403)],
    )
    def test_update(self, workspace, project, link, clients, role, expected):
        response = clients[role].patch(
            _links_url(workspace.slug, project.id, f"{link.id}/"), {"title": "Docs"}, format="json"
        )

        assert response.status_code == expected
        link.refresh_from_db()
        assert link.title == ("Docs" if expected == 200 else "Wiki")

    @pytest.mark.parametrize(
        "role,expected",
        [("admin", 204), ("member", 403), ("guest", 403), ("non_member", 403)],
    )
    def test_delete(self, workspace, project, link, clients, role, expected):
        response = clients[role].delete(_links_url(workspace.slug, project.id, f"{link.id}/"))

        assert response.status_code == expected
        assert ProjectLink.objects.filter(pk=link.id).exists() == (expected != 204)

    @pytest.mark.parametrize(
        "role,expected",
        [("admin", 200), ("member", 403), ("guest", 403), ("non_member", 403)],
    )
    def test_reorder(self, workspace, project, link, clients, role, expected):
        response = clients[role].post(
            _links_url(workspace.slug, project.id, "reorder/"), {"link_ids": [str(link.id)]}, format="json"
        )

        assert response.status_code == expected

    def test_delete_is_soft(self, workspace, project, link, clients):
        clients["admin"].delete(_links_url(workspace.slug, project.id, f"{link.id}/"))

        assert ProjectLink.all_objects.get(pk=link.id).deleted_at is not None
        assert clients["admin"].get(_links_url(workspace.slug, project.id)).json() == []

    def test_link_of_other_project_is_not_found(self, workspace, project, link, clients, create_user):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(workspace=workspace, project=other, member=create_user, role=ADMIN)
        client = APIClient()
        client.force_authenticate(user=create_user)

        response = client.patch(_links_url(workspace.slug, other.id, f"{link.id}/"), {"title": "X"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectLinkUrlValidation:
    @pytest.mark.parametrize(
        "url",
        [
            "https://github.com/inomotech-foss/paperplane",
            "http://example.com",
            "/ws/projects/abc/pages/def",
            "/ws/projects/abc/pages/?q=1#top",
        ],
    )
    def test_accepts(self, workspace, project, clients, url):
        response = clients["admin"].post(
            _links_url(workspace.slug, project.id), {"title": "T", "url": url}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["url"] == url

    @pytest.mark.parametrize(
        "url",
        [
            "javascript:alert(1)",
            "JavaScript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)",
            "ftp://example.com/file",
            "mailto:a@example.com",
            "//evil.example.com",
            "/\\evil.example.com",
            "/\t/evil.example.com",
            "example.com",
            "relative/path",
            "",
            "   ",
        ],
    )
    def test_rejects(self, workspace, project, clients, url):
        response = clients["admin"].post(
            _links_url(workspace.slug, project.id), {"title": "T", "url": url}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "url" in response.json()
        assert not ProjectLink.objects.filter(project=project).exists()

    def test_update_rejects_javascript(self, workspace, project, link, clients):
        response = clients["admin"].patch(
            _links_url(workspace.slug, project.id, f"{link.id}/"), {"url": "javascript:alert(1)"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        link.refresh_from_db()
        assert link.url == "https://example.com/wiki"

    def test_rejects_blank_title(self, workspace, project, clients):
        response = clients["admin"].post(
            _links_url(workspace.slug, project.id), {"title": "  ", "url": "https://example.com"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectLinkOrdering:
    def _create(self, client, workspace, project, title):
        response = client.post(
            _links_url(workspace.slug, project.id), {"title": title, "url": f"/{title}"}, format="json"
        )
        return response.json()["id"]

    def test_new_links_append(self, workspace, project, clients):
        ids = [self._create(clients["admin"], workspace, project, title) for title in ("a", "b", "c")]

        listed = clients["guest"].get(_links_url(workspace.slug, project.id)).json()

        assert [item["id"] for item in listed] == ids

    def test_reorder(self, workspace, project, clients):
        a, b, c = (self._create(clients["admin"], workspace, project, title) for title in ("a", "b", "c"))

        response = clients["admin"].post(
            _links_url(workspace.slug, project.id, "reorder/"), {"link_ids": [c, a, b]}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert [item["id"] for item in response.json()] == [c, a, b]
        listed = clients["member"].get(_links_url(workspace.slug, project.id)).json()
        assert [item["id"] for item in listed] == [c, a, b]

    @pytest.mark.parametrize("mode", ["missing", "duplicate", "foreign", "not_a_list"])
    def test_reorder_rejects_mismatched_ids(self, workspace, project, clients, mode):
        a, b = (self._create(clients["admin"], workspace, project, title) for title in ("a", "b"))
        payload = {
            "missing": [a],
            "duplicate": [a, b, a],
            "foreign": [a, b, str(uuid.uuid4())],
            "not_a_list": a,
        }[mode]

        response = clients["admin"].post(
            _links_url(workspace.slug, project.id, "reorder/"), {"link_ids": payload}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceProjectLinks:
    def test_returns_links_of_joined_projects_only(self, workspace, project, link, clients, create_user):
        hidden = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace, created_by=create_user)
        ProjectLink.objects.create(project=hidden, title="Secret", url="https://example.com/secret")
        url = f"/api/workspaces/{workspace.slug}/project-links/"

        for role in ("admin", "member", "guest"):
            response = clients[role].get(url)
            assert response.status_code == status.HTTP_200_OK
            assert [item["id"] for item in response.json()] == [str(link.id)]

        response = clients["non_member"].get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_excludes_inactive_membership(self, workspace, project, link, clients):
        ProjectMember.objects.filter(project=project, member__email="member@plane.so").update(is_active=False)

        response = clients["member"].get(f"/api/workspaces/{workspace.slug}/project-links/")

        assert response.json() == []
