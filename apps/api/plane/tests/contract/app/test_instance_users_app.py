# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the instance admin user endpoints."""

import pytest
from unittest.mock import patch

from plane.db.models import Account, User, Workspace, WorkspaceMember
from plane.license.utils.user_lifecycle import soft_delete_user

URL = "/api/instances/users/"


@pytest.fixture
def alice(db):
    user = User.objects.create(email="alice@plane.so", username="alice", first_name="Alice")
    Account.objects.create(user=user, provider="google", provider_account_id="a", access_token="t")
    return user


@pytest.fixture
def bob(db):
    return User.objects.create(email="bob@plane.so", username="bob", display_name="Bobby")


@pytest.fixture
def workspace(alice):
    workspace = Workspace.objects.create(name="W", slug="w", owner=alice)
    WorkspaceMember.objects.create(workspace=workspace, member=alice, role=20)
    return workspace


@pytest.mark.contract
class TestInstanceUserList:
    @pytest.mark.django_db
    def test_lists_users_with_counts_and_providers(self, instance_admin_client, alice, bob, workspace):
        response = instance_admin_client.get(URL)

        assert response.status_code == 200
        rows = {row["email"]: row for row in response.json()["results"]}
        assert rows["alice@plane.so"]["providers"] == ["google"]
        assert rows["alice@plane.so"]["workspace_count"] == 1
        assert rows["alice@plane.so"]["is_instance_admin"] is False
        assert rows["test@plane.so"]["is_instance_admin"] is True
        assert rows["bob@plane.so"]["workspace_count"] == 0

    @pytest.mark.django_db
    def test_search_and_filters(self, instance_admin_client, alice, bob):
        bob.is_active = False
        bob.save()

        by_name = instance_admin_client.get(URL, {"search": "bobby"}).json()["results"]
        assert [row["email"] for row in by_name] == ["bob@plane.so"]

        inactive = instance_admin_client.get(URL, {"is_active": "false"}).json()["results"]
        assert [row["email"] for row in inactive] == ["bob@plane.so"]

    @pytest.mark.django_db
    def test_deleted_users_are_hidden_unless_asked_for(self, instance_admin_client, alice, bob):
        soft_delete_user(bob)

        emails = [row["email"] for row in instance_admin_client.get(URL).json()["results"]]
        assert not any(email.endswith("@deleted.invalid") for email in emails)

        rows = instance_admin_client.get(URL, {"include_deleted": "1"}).json()["results"]
        deleted = [row for row in rows if row["deleted_at"]]
        assert len(deleted) == 1
        assert deleted[0]["id"] == str(bob.id)

    @pytest.mark.django_db
    def test_non_admins_are_refused(self, api_client, alice):
        api_client.force_authenticate(user=alice)
        assert api_client.get(URL).status_code == 403


@pytest.mark.contract
class TestInstanceUserDetail:
    @pytest.mark.django_db
    def test_detail_lists_memberships_and_owned_workspaces(self, instance_admin_client, alice, workspace):
        response = instance_admin_client.get(f"{URL}{alice.id}/")

        assert response.status_code == 200
        body = response.json()
        assert body["memberships"] == [
            {"workspace_id": str(workspace.id), "slug": "w", "name": "W", "role": 20, "is_active": True}
        ]
        assert body["owned_workspaces"] == [{"id": str(workspace.id), "slug": "w", "name": "W"}]

    @pytest.mark.django_db
    def test_unknown_user_is_404(self, instance_admin_client):
        assert instance_admin_client.get(f"{URL}00000000-0000-0000-0000-000000000000/").status_code == 404


@pytest.mark.contract
class TestInstanceUserDeactivate:
    @pytest.mark.django_db
    @patch("plane.license.utils.user_lifecycle.user_deactivation_email")
    def test_deactivates_and_reports_sole_admin_workspaces(self, email, instance_admin_client, alice, workspace):
        response = instance_admin_client.post(f"{URL}{alice.id}/deactivate/")

        assert response.status_code == 200
        assert response.json()["sole_admin_workspaces"] == ["w"]
        assert response.json()["user"]["is_active"] is False
        alice.refresh_from_db()
        assert alice.is_active is False
        email.delay.assert_called_once()

    @pytest.mark.django_db
    def test_cannot_deactivate_yourself(self, instance_admin_client, create_user):
        response = instance_admin_client.post(f"{URL}{create_user.id}/deactivate/")

        assert response.status_code == 400
        create_user.refresh_from_db()
        assert create_user.is_active is True

    @pytest.mark.django_db
    @patch("plane.license.utils.user_lifecycle.user_deactivation_email")
    def test_reactivate(self, _email, instance_admin_client, alice):
        instance_admin_client.post(f"{URL}{alice.id}/deactivate/")

        response = instance_admin_client.post(f"{URL}{alice.id}/reactivate/")

        assert response.status_code == 200
        assert response.json()["user"]["is_active"] is True


@pytest.mark.contract
class TestInstanceUserDelete:
    @pytest.mark.django_db
    def test_soft_deletes(self, instance_admin_client, bob):
        response = instance_admin_client.delete(f"{URL}{bob.id}/")

        assert response.status_code == 204
        bob.refresh_from_db()
        assert bob.deleted_at is not None
        assert bob.email.endswith("@deleted.invalid")

    @pytest.mark.django_db
    def test_refuses_an_owner_with_the_slugs(self, instance_admin_client, alice, workspace):
        response = instance_admin_client.delete(f"{URL}{alice.id}/")

        assert response.status_code == 409
        assert response.json()["owned_workspaces"] == ["w"]
        alice.refresh_from_db()
        assert alice.deleted_at is None

    @pytest.mark.django_db
    def test_refuses_the_caller_and_bots(self, instance_admin_client, create_user, create_bot_user):
        assert instance_admin_client.delete(f"{URL}{create_user.id}/").status_code == 400
        assert instance_admin_client.delete(f"{URL}{create_bot_user.id}/").status_code == 400


@pytest.mark.contract
class TestInstanceUserMerge:
    @pytest.mark.django_db
    def test_preview_then_merge(self, instance_admin_client, alice, bob, workspace):
        WorkspaceMember.objects.create(workspace=workspace, member=bob, role=5)
        body = {"source": str(bob.id), "keep_source_email": True}

        preview = instance_admin_client.post(f"{URL}{alice.id}/merge/preview/", body, format="json")

        assert preview.status_code == 200
        assert preview.json()["email"] == "bob@plane.so"
        assert preview.json()["relations"]["db.WorkspaceMember.member"] == {"moved": 0, "dropped": 1}
        bob.refresh_from_db()
        assert bob.deleted_at is None

        merged = instance_admin_client.post(f"{URL}{alice.id}/merge/", body, format="json")

        assert merged.status_code == 200
        assert merged.json()["relations"] == preview.json()["relations"]
        alice.refresh_from_db()
        bob.refresh_from_db()
        assert alice.email == "bob@plane.so"
        assert bob.merged_into == alice

    @pytest.mark.django_db
    def test_refusals(self, instance_admin_client, alice, bob, create_user):
        assert instance_admin_client.post(f"{URL}{alice.id}/merge/", {}, format="json").status_code == 400
        same = instance_admin_client.post(f"{URL}{alice.id}/merge/", {"source": str(alice.id)}, format="json")
        assert same.status_code == 400
        own = instance_admin_client.post(f"{URL}{alice.id}/merge/", {"source": str(create_user.id)}, format="json")
        assert own.status_code == 400
        assert "own account" in own.json()["error"]
