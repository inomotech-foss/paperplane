# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for deactivating, reactivating and soft deleting users as an instance admin.
"""

import pytest

from plane.db.models import (
    Account,
    APIToken,
    Profile,
    Project,
    ProjectMember,
    Session,
    User,
    Workspace,
    WorkspaceMember,
    WorkspaceMemberInvite,
)
from plane.license.utils.user_lifecycle import (
    UserLifecycleError,
    deactivate_user,
    deleted_email,
    reactivate_user,
    soft_delete_user,
)


@pytest.fixture
def user(db):
    user = User.objects.create(email="target@plane.so", username="target", first_name="Tara", avatar="x")
    user.set_password("secret")
    user.save()
    Profile.objects.create(user=user, is_onboarded=True)
    return user


@pytest.fixture
def other(db):
    return User.objects.create(email="other@plane.so", username="other")


@pytest.fixture
def workspace(other):
    workspace = Workspace.objects.create(name="W", slug="w", owner=other)
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
    return workspace


@pytest.mark.unit
class TestDeactivateUser:
    @pytest.mark.django_db
    def test_reports_where_the_user_was_the_only_admin(self, user, other, workspace):
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=20)
        project = Project.objects.create(name="P", identifier="P", workspace=workspace)
        ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=20)
        ProjectMember.objects.create(project=project, member=other, workspace=workspace, role=15)

        result = deactivate_user(user)

        assert result == {
            "sole_admin_workspaces": ["w"],
            "sole_admin_projects": [{"workspace": "w", "name": "P"}],
        }
        assert not WorkspaceMember.objects.filter(member=user, is_active=True).exists()
        assert not ProjectMember.objects.filter(member=user, is_active=True).exists()

    @pytest.mark.django_db
    def test_locks_the_account(self, user, workspace):
        WorkspaceMemberInvite.objects.create(workspace=workspace, email=user.email, token="t")
        Session.objects.create(session_key="k", user_id=str(user.id), expire_date="2099-01-01T00:00:00Z")

        deactivate_user(user)

        user.refresh_from_db()
        assert user.is_active is False
        assert user.last_logout_time is not None
        assert user.is_password_autoset is True
        assert not user.check_password("secret")
        assert not WorkspaceMemberInvite.objects.filter(email=user.email).exists()
        assert not Session.objects.filter(user_id=str(user.id)).exists()
        assert Profile.objects.get(user=user).is_onboarded is False

    @pytest.mark.django_db
    def test_reactivate_leaves_memberships_inactive(self, user, workspace):
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=20)
        deactivate_user(user)

        reactivate_user(user)

        user.refresh_from_db()
        assert user.is_active is True
        assert not WorkspaceMember.objects.filter(member=user, is_active=True).exists()


@pytest.mark.unit
class TestSoftDeleteUser:
    @pytest.mark.django_db
    def test_anonymises_and_revokes_everything(self, user):
        Account.objects.create(user=user, provider="google", provider_account_id="g", access_token="t")
        APIToken.objects.create(user=user, label="t")

        soft_delete_user(user)

        user.refresh_from_db()
        assert user.deleted_at is not None
        assert user.is_active is False
        assert user.email == deleted_email(user.id)
        assert user.first_name == ""
        assert user.avatar == ""
        assert not Account.objects.filter(user=user).exists()
        assert not APIToken.objects.filter(user=user).exists()

    @pytest.mark.django_db
    def test_refuses_while_the_user_owns_a_workspace(self, user):
        Workspace.objects.create(name="Mine", slug="mine", owner=user)

        with pytest.raises(UserLifecycleError) as excinfo:
            soft_delete_user(user)

        assert excinfo.value.payload == {"owned_workspaces": ["mine"]}
        user.refresh_from_db()
        assert user.deleted_at is None

    @pytest.mark.django_db
    def test_refuses_bots_and_repeats(self, user):
        bot = User.objects.create(email="bot@plane.so", username="bot", is_bot=True)
        with pytest.raises(UserLifecycleError):
            soft_delete_user(bot)

        soft_delete_user(user)
        with pytest.raises(UserLifecycleError):
            soft_delete_user(user)
        with pytest.raises(UserLifecycleError):
            reactivate_user(user)
