# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging
import os

# Django imports
from django.db import transaction

# Module imports
from plane.db.models import Profile, Workspace, WorkspaceMember
from plane.db.models.workspace import ROLE_CHOICES
from plane.license.utils.instance_value import get_configuration_value
from plane.utils.exception_logger import log_exception

logger = logging.getLogger("plane.authentication")

DEFAULT_ROLE = 15


def parse_role(role):
    try:
        value = int(role)
    except (TypeError, ValueError):
        return DEFAULT_ROLE
    return value if value in dict(ROLE_CHOICES) else DEFAULT_ROLE


def get_auto_join_settings():
    slug, role = get_configuration_value(
        [
            {"key": "AUTO_JOIN_WORKSPACE", "default": os.environ.get("AUTO_JOIN_WORKSPACE", "")},
            {
                "key": "AUTO_JOIN_WORKSPACE_ROLE",
                "default": os.environ.get("AUTO_JOIN_WORKSPACE_ROLE", str(DEFAULT_ROLE)),
            },
        ]
    )
    return (slug or "").strip(), parse_role(role)


def sync_workspace_membership(user, slug, role):
    """Add the user to the configured workspace, keeping existing memberships."""
    if not slug:
        return
    workspace = Workspace.objects.filter(slug=slug).first()
    if workspace is None:
        logger.warning("Auto-join workspace %s does not exist", slug)
        return
    with transaction.atomic():
        # Only ever adds: an existing membership may have been granted deliberately
        # at another role, so unlike instance admin this never removes or downgrades.
        member, _ = WorkspaceMember.objects.get_or_create(workspace=workspace, member=user, defaults={"role": role})
        # Onboarding only exists to put a user in a workspace, which is done now.
        # A membership an admin deactivated is left alone, so that user still needs it.
        if member.is_active:
            Profile.objects.update_or_create(user=user, defaults={"is_onboarded": True})


def auto_join_workspace(user):
    """Provision the configured membership without ever failing the login."""
    try:
        slug, role = get_auto_join_settings()
        sync_workspace_membership(user=user, slug=slug, role=role)
    except Exception as e:
        log_exception(e)
