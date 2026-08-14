# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest

from plane.db.models import User, Workspace
from plane.license.utils.workspace_provisioning import (
    WORKSPACE_OWNER_BOT_EMAIL,
    WorkspaceProvisioningError,
    get_owner_bot,
    provision_workspace,
)


def make_user(email=None):
    return User.objects.create(email=email or f"u-{uuid.uuid4().hex}@example.com", username=uuid.uuid4().hex)


@pytest.mark.unit
@pytest.mark.django_db
class TestOwnerBot:
    def test_the_bot_cannot_sign_in(self):
        bot = get_owner_bot()

        assert bot.is_bot is True
        assert bot.is_active is False
        assert bot.email == WORKSPACE_OWNER_BOT_EMAIL

    def test_the_bot_is_created_once(self):
        first = get_owner_bot()
        second = get_owner_bot()

        assert first.id == second.id
        assert User.objects.filter(email=WORKSPACE_OWNER_BOT_EMAIL).count() == 1


@pytest.mark.unit
@pytest.mark.django_db
class TestProvisionWorkspace:
    def test_a_workspace_is_created_with_no_human_users_present(self):
        """The whole point: a claim-based install has no user at startup."""
        assert User.objects.count() == 0

        workspace, created = provision_workspace("acme", "Acme")

        assert created is True
        assert workspace.slug == "acme"
        assert workspace.name == "Acme"
        assert workspace.owner.is_bot is True

    def test_the_name_falls_back_to_the_slug(self):
        workspace, _ = provision_workspace("acme", "")

        assert workspace.name == "acme"

    def test_a_second_run_changes_nothing(self):
        first, created_first = provision_workspace("acme", "Acme")
        second, created_second = provision_workspace("acme", "Acme")

        assert created_first is True
        assert created_second is False
        assert first.id == second.id
        assert Workspace.objects.filter(slug="acme").count() == 1

    def test_an_existing_workspace_keeps_its_owner_and_name(self):
        owner = make_user()
        Workspace.objects.create(name="Hand Made", slug="acme", owner=owner)

        workspace, created = provision_workspace("acme", "Provisioned")

        assert created is False
        assert workspace.owner_id == owner.id
        assert workspace.name == "Hand Made"
        assert User.objects.filter(email=WORKSPACE_OWNER_BOT_EMAIL).exists() is False

    def test_an_empty_slug_provisions_nothing(self):
        workspace, created = provision_workspace("", "Acme")

        assert workspace is None
        assert created is False
        assert Workspace.objects.count() == 0

    def test_a_reserved_slug_is_refused(self):
        with pytest.raises(WorkspaceProvisioningError):
            provision_workspace("god-mode", "God Mode")

        assert Workspace.objects.count() == 0

    def test_an_overlong_slug_is_refused(self):
        with pytest.raises(WorkspaceProvisioningError):
            provision_workspace("w" * 49, "Long")

        assert Workspace.objects.count() == 0
