# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the instance admin workspace detail endpoints."""

import pytest
from unittest.mock import patch

from plane.db.models import Profile, User, Workspace, WorkspaceMember

URL = "/api/instances/workspaces/"


@pytest.fixture
def owner(db):
    return User.objects.create(email="owner@plane.so", username="owner")


@pytest.fixture
def workspace(owner):
    workspace = Workspace.objects.create(name="W", slug="w", owner=owner)
    WorkspaceMember.objects.create(workspace=workspace, member=owner, role=20)
    return workspace


@pytest.mark.contract
class TestInstanceWorkspaceDetail:
    @pytest.mark.django_db
    def test_detail(self, instance_admin_client, workspace, owner):
        response = instance_admin_client.get(f"{URL}{workspace.id}/")

        assert response.status_code == 200
        body = response.json()
        assert body["slug"] == "w"
        assert body["owner"]["email"] == "owner@plane.so"
        assert body["total_members"] == 1
        assert body["total_projects"] == 0

    @pytest.mark.django_db
    @patch("plane.db.mixins.soft_delete_related_objects")
    def test_delete_soft_deletes_and_clears_last_workspace(self, _task, instance_admin_client, workspace, owner):
        Profile.objects.create(user=owner, last_workspace_id=workspace.id)

        response = instance_admin_client.delete(f"{URL}{workspace.id}/")

        assert response.status_code == 204
        assert not Workspace.objects.filter(pk=workspace.id).exists()
        assert Workspace.all_objects.get(pk=workspace.id).deleted_at is not None
        assert Profile.objects.get(user=owner).last_workspace_id is None

    @pytest.mark.django_db
    def test_non_admins_are_refused(self, api_client, owner, workspace):
        api_client.force_authenticate(user=owner)
        response = api_client.delete(f"{URL}{workspace.id}/")
        assert response.status_code == 403
        assert Workspace.objects.filter(pk=workspace.id).exists()


@pytest.mark.contract
class TestInstanceWorkspaceTransferOwner:
    @pytest.mark.django_db
    def test_new_owner_becomes_an_active_admin(self, instance_admin_client, workspace):
        new_owner = User.objects.create(email="new@plane.so", username="new")
        WorkspaceMember.objects.create(workspace=workspace, member=new_owner, role=5, is_active=False)

        response = instance_admin_client.post(f"{URL}{workspace.id}/transfer-owner/", {"owner": str(new_owner.id)})

        assert response.status_code == 200
        assert response.json()["owner"]["email"] == "new@plane.so"
        membership = WorkspaceMember.objects.get(workspace=workspace, member=new_owner)
        assert membership.role == 20
        assert membership.is_active is True

    @pytest.mark.django_db
    def test_outsider_is_added_as_admin(self, instance_admin_client, workspace):
        new_owner = User.objects.create(email="new@plane.so", username="new")

        response = instance_admin_client.post(f"{URL}{workspace.id}/transfer-owner/", {"owner": str(new_owner.id)})

        assert response.status_code == 200
        assert WorkspaceMember.objects.get(workspace=workspace, member=new_owner).role == 20

    @pytest.mark.django_db
    def test_refuses_bots_and_inactive_users(self, instance_admin_client, workspace, create_bot_user):
        inactive = User.objects.create(email="off@plane.so", username="off", is_active=False)

        bot = instance_admin_client.post(f"{URL}{workspace.id}/transfer-owner/", {"owner": str(create_bot_user.id)})
        off = instance_admin_client.post(f"{URL}{workspace.id}/transfer-owner/", {"owner": str(inactive.id)})
        missing = instance_admin_client.post(f"{URL}{workspace.id}/transfer-owner/", {})

        assert bot.status_code == 400
        assert off.status_code == 400
        assert missing.status_code == 400
        workspace.refresh_from_db()
        assert workspace.owner.email == "owner@plane.so"
