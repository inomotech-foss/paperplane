# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging
import uuid

# Django imports
from django.db import transaction

# Module imports
from plane.db.models import Profile, User, Workspace
from plane.license.utils.instance_value import get_configuration_value
from plane.utils.constants import RESTRICTED_WORKSPACE_SLUGS

logger = logging.getLogger("plane.license")

# The workspace owner is a non-nullable FK, but on a claim-based install no human
# user exists at startup. A bot owns it instead: owner carries no authority in
# this codebase, only membership does.
WORKSPACE_OWNER_BOT_EMAIL = "workspace-owner-bot@plane.internal"


class WorkspaceProvisioningError(Exception):
    """A configured workspace could not be provisioned."""


def get_workspace_settings():
    slug, name = get_configuration_value(
        [
            {"key": "PROVISION_WORKSPACE_SLUG", "default": ""},
            {"key": "PROVISION_WORKSPACE_NAME", "default": ""},
        ]
    )
    slug = (slug or "").strip().lower()
    return slug, (name or "").strip()


def get_owner_bot():
    """The system user that owns provisioned workspaces.

    Never active and never a login, so it cannot be signed in as. Deleting it
    would cascade the workspace away, which is why it is not a human account.
    """
    bot = User.objects.filter(email=WORKSPACE_OWNER_BOT_EMAIL).first()
    if bot is None:
        bot = User.objects.create(
            email=WORKSPACE_OWNER_BOT_EMAIL,
            username=uuid.uuid4().hex,
            display_name="Workspace Owner",
            first_name="Workspace",
            last_name="Owner",
            is_bot=True,
            is_active=False,
        )
        Profile.objects.get_or_create(user=bot)
    return bot


def provision_workspace(slug, name):
    """Create the configured workspace, or adopt one that already exists.

    Returns `(workspace, created)`. An existing workspace keeps its owner and
    every other setting: someone may have created it by hand already.
    """
    if not slug:
        return None, False
    if slug in RESTRICTED_WORKSPACE_SLUGS:
        raise WorkspaceProvisioningError(f"'{slug}' is a reserved workspace slug")
    if len(slug) > 48:
        raise WorkspaceProvisioningError("Workspace slug is longer than 48 characters")

    existing = Workspace.objects.filter(slug=slug).first()
    if existing is not None:
        return existing, False

    with transaction.atomic():
        # Replicas start together during a rollout, so let the unique slug settle
        # the race rather than locking a table.
        workspace, created = Workspace.objects.get_or_create(
            slug=slug,
            defaults={"name": (name or slug)[:80], "owner": get_owner_bot()},
        )
    return workspace, created
