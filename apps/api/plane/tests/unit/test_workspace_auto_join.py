# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest

from plane.authentication.utils.redirection_path import get_redirection_path
from plane.authentication.utils.workspace_membership import (
    auto_join_workspace,
    parse_role,
    sync_workspace_membership,
)
from plane.db.models import Profile, User, Workspace, WorkspaceMember


def make_user(email="member@example.com"):
    return User.objects.create(email=email, username=uuid.uuid4().hex)


def make_workspace(slug="acme"):
    owner = make_user(f"owner-{uuid.uuid4().hex}@example.com")
    return Workspace.objects.create(name="Acme", slug=slug, owner=owner)


@pytest.mark.unit
class TestParseRole:
    def test_valid_role(self):
        assert parse_role("20") == 20

    def test_unknown_role_falls_back_to_member(self):
        assert parse_role("7") == 15

    def test_garbage_falls_back_to_member(self):
        assert parse_role("member") == 15
        assert parse_role(None) == 15


@pytest.mark.unit
@pytest.mark.django_db
class TestSyncWorkspaceMembership:
    def test_first_login_joins_configured_workspace(self):
        workspace = make_workspace()
        user = make_user()

        sync_workspace_membership(user=user, slug="acme", role=15)

        member = WorkspaceMember.objects.get(workspace=workspace, member=user)
        assert member.role == 15

    def test_second_login_is_idempotent(self):
        make_workspace()
        user = make_user()

        sync_workspace_membership(user=user, slug="acme", role=15)
        sync_workspace_membership(user=user, slug="acme", role=15)

        assert WorkspaceMember.objects.filter(member=user).count() == 1

    def test_existing_higher_role_is_not_downgraded(self):
        workspace = make_workspace()
        user = make_user()
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=20)

        sync_workspace_membership(user=user, slug="acme", role=15)

        assert WorkspaceMember.objects.get(member=user).role == 20

    def test_other_memberships_are_untouched(self):
        other = make_workspace(slug="demo-workspace")
        make_workspace()
        user = make_user()
        WorkspaceMember.objects.create(workspace=other, member=user, role=5)

        sync_workspace_membership(user=user, slug="acme", role=15)

        assert WorkspaceMember.objects.filter(member=user, workspace=other).exists()

    def test_unset_slug_is_a_noop(self):
        make_workspace()
        user = make_user()

        sync_workspace_membership(user=user, slug="", role=15)

        assert WorkspaceMember.objects.filter(member=user).count() == 0
        assert not Profile.objects.filter(user=user, is_onboarded=True).exists()

    def test_unknown_slug_logs_and_does_not_raise(self, caplog):
        user = make_user()

        sync_workspace_membership(user=user, slug="does-not-exist", role=15)

        assert WorkspaceMember.objects.filter(member=user).count() == 0
        assert "does-not-exist" in caplog.text

    def test_joined_user_is_marked_onboarded(self):
        make_workspace()
        user = make_user()
        Profile.objects.create(user=user)

        sync_workspace_membership(user=user, slug="acme", role=15)

        assert Profile.objects.get(user=user).is_onboarded is True


@pytest.mark.unit
@pytest.mark.django_db
class TestAutoJoinWorkspace:
    def test_joins_the_configured_workspace(self, settings, monkeypatch):
        settings.SKIP_ENV_VAR = False
        monkeypatch.setenv("AUTO_JOIN_WORKSPACE", "acme")
        monkeypatch.setenv("AUTO_JOIN_WORKSPACE_ROLE", "20")
        make_workspace()
        user = make_user()

        auto_join_workspace(user=user)

        assert WorkspaceMember.objects.get(member=user).role == 20

    def test_unset_setting_is_a_noop(self, settings, monkeypatch):
        settings.SKIP_ENV_VAR = False
        monkeypatch.delenv("AUTO_JOIN_WORKSPACE", raising=False)
        make_workspace()
        user = make_user()

        auto_join_workspace(user=user)

        assert WorkspaceMember.objects.filter(member=user).count() == 0

    def test_provisioning_failure_never_reaches_the_login(self, settings, monkeypatch):
        settings.SKIP_ENV_VAR = False
        monkeypatch.setenv("AUTO_JOIN_WORKSPACE", "acme")
        make_workspace()
        user = make_user()

        def boom(**kwargs):
            raise RuntimeError("database is on fire")

        monkeypatch.setattr(
            "plane.authentication.utils.workspace_membership.sync_workspace_membership",
            boom,
        )

        auto_join_workspace(user=user)

        assert WorkspaceMember.objects.filter(member=user).count() == 0


@pytest.mark.unit
@pytest.mark.django_db
class TestRedirectionPath:
    def test_auto_joined_user_lands_in_the_workspace(self):
        make_workspace()
        user = make_user()

        sync_workspace_membership(user=user, slug="acme", role=15)

        assert get_redirection_path(user=user) == "acme"

    def test_user_without_workspace_still_onboards(self):
        user = make_user()

        assert get_redirection_path(user=user) == "onboarding"
