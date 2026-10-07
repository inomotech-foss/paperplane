# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import Project, ProjectMember, User, WorkspaceMember


def _make_user(workspace, email, display_name, ws_role=15):
    user = User.objects.create(email=email, username=email.split("@")[0], display_name=display_name)
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=ws_role)
    return user


def _search(client, slug, **params):
    return client.get(f"/api/workspaces/{slug}/entity-search/", {"query_type": "user_mention", **params})


@pytest.fixture
def secret_member(db, workspace):
    return _make_user(workspace, "secret@plane.so", "secretmember")


@pytest.fixture
def secret_project(db, workspace, secret_member):
    project = Project.objects.create(
        name="Secret", identifier="SEC", workspace=workspace, network=0, created_by=secret_member
    )
    ProjectMember.objects.create(project=project, member=secret_member, role=20, is_active=True)
    return project


def _member_ids(response):
    return {str(u["member__id"]) for u in response.data["user_mention"]}


@pytest.mark.contract
@pytest.mark.django_db
class TestEntitySearchProjectAccess:
    def test_non_member_gets_no_project_members(self, session_client, workspace, secret_project):
        response = _search(session_client, workspace.slug, project_id=str(secret_project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["user_mention"] == []

    def test_inactive_member_gets_no_project_members(self, session_client, workspace, secret_project, create_user):
        ProjectMember.objects.create(project=secret_project, member=create_user, role=15, is_active=False)
        response = _search(session_client, workspace.slug, project_id=str(secret_project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["user_mention"] == []

    def test_member_gets_project_members(self, session_client, workspace, secret_project, secret_member, create_user):
        ProjectMember.objects.create(project=secret_project, member=create_user, role=15, is_active=True)
        response = _search(session_client, workspace.slug, project_id=str(secret_project.id))
        assert response.status_code == status.HTTP_200_OK
        assert _member_ids(response) == {str(secret_member.id), str(create_user.id)}

    def test_without_project_lists_workspace_members(self, session_client, workspace, secret_member):
        response = _search(session_client, workspace.slug)
        assert response.status_code == status.HTTP_200_OK
        assert str(secret_member.id) in _member_ids(response)


@pytest.fixture
def public_project(db, workspace, create_user, secret_member):
    project = Project.objects.create(name="Public", identifier="PUB", workspace=workspace, network=2)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    ProjectMember.objects.create(project=project, member=secret_member, role=15, is_active=True)
    return project


@pytest.mark.contract
@pytest.mark.django_db
class TestEntitySearchPublicProjectMentions:
    def test_lists_project_members_then_joinable_workspace_members(
        self, session_client, workspace, public_project, secret_member, create_user
    ):
        ws_member = _make_user(workspace, "wsmember@plane.so", "wsmember", ws_role=15)
        ws_admin = _make_user(workspace, "wsadmin@plane.so", "wsadmin", ws_role=20)
        guest = _make_user(workspace, "guest@plane.so", "guest", ws_role=5)
        inactive = _make_user(workspace, "inactive@plane.so", "inactive")
        WorkspaceMember.objects.filter(member=inactive).update(is_active=False)

        response = _search(session_client, workspace.slug, project_id=str(public_project.id), count=20)
        assert response.status_code == status.HTTP_200_OK
        flags = [(str(u["member__id"]), u["is_project_member"]) for u in response.data["user_mention"]]
        members = {user_id for user_id, is_member in flags if is_member}
        others = {user_id for user_id, is_member in flags if not is_member}
        assert members == {str(create_user.id), str(secret_member.id)}
        assert others == {str(ws_member.id), str(ws_admin.id)}
        assert all(is_member for _, is_member in flags[: len(members)])
        assert str(guest.id) not in others

    def test_query_filters_non_members(self, session_client, workspace, public_project):
        ws_member = _make_user(workspace, "wsmember@plane.so", "wsmember", ws_role=15)
        _make_user(workspace, "other@plane.so", "someoneelse", ws_role=15)
        response = _search(session_client, workspace.slug, project_id=str(public_project.id), query="wsmem")
        assert response.status_code == status.HTTP_200_OK
        assert _member_ids(response) == {str(ws_member.id)}

    def test_secret_project_lists_only_project_members(
        self, session_client, workspace, secret_project, secret_member, create_user
    ):
        ProjectMember.objects.create(project=secret_project, member=create_user, role=15, is_active=True)
        _make_user(workspace, "wsmember@plane.so", "wsmember", ws_role=15)
        response = _search(session_client, workspace.slug, project_id=str(secret_project.id), count=20)
        assert response.status_code == status.HTTP_200_OK
        assert _member_ids(response) == {str(secret_member.id), str(create_user.id)}
        assert all(u["is_project_member"] for u in response.data["user_mention"])
