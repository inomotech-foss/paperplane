# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from django.db import transaction
from django.utils import timezone
from oauth2_provider.models import get_access_token_model, get_refresh_token_model

from plane.bgtasks.user_deactivation_email_task import user_deactivation_email
from plane.db.models import (
    Account,
    APIToken,
    Profile,
    ProjectMember,
    Session,
    Workspace,
    WorkspaceMember,
    WorkspaceMemberInvite,
)
from plane.db.models.user import get_default_onboarding

ADMIN_ROLE = 20

DELETED_EMAIL_DOMAIN = "deleted.invalid"


class UserLifecycleError(Exception):
    def __init__(self, message, **payload):
        super().__init__(message)
        self.message = message
        self.payload = payload


def deleted_email(user_id):
    return f"deleted+{user_id}@{DELETED_EMAIL_DOMAIN}"


def sole_admin_workspaces(user):
    """Slugs of the workspaces where this user is the only active admin."""
    memberships = WorkspaceMember.objects.filter(member=user, is_active=True, role=ADMIN_ROLE).select_related(
        "workspace"
    )
    slugs = []
    for membership in memberships:
        other_admin = (
            WorkspaceMember.objects.filter(workspace_id=membership.workspace_id, is_active=True, role=ADMIN_ROLE)
            .exclude(member=user)
            .exists()
        )
        if not other_admin:
            slugs.append(membership.workspace.slug)
    return slugs


def sole_admin_projects(user):
    memberships = ProjectMember.objects.filter(member=user, is_active=True, role=ADMIN_ROLE).select_related(
        "project", "workspace"
    )
    projects = []
    for membership in memberships:
        other_admin = (
            ProjectMember.objects.filter(project_id=membership.project_id, is_active=True, role=ADMIN_ROLE)
            .exclude(member=user)
            .exists()
        )
        if not other_admin:
            projects.append({"workspace": membership.workspace.slug, "name": membership.project.name})
    return projects


def revoke_sessions_and_tokens(user):
    Session.objects.filter(user_id=str(user.id)).delete()
    APIToken.objects.filter(user=user).delete()
    get_access_token_model().objects.filter(user=user).delete()
    get_refresh_token_model().objects.filter(user=user).delete()


def reset_profile(user):
    Profile.objects.filter(user=user).update(
        last_workspace_id=None,
        is_tour_completed=False,
        is_onboarded=False,
        onboarding_step=get_default_onboarding(),
    )


@transaction.atomic
def deactivate_user(user, *, current_site=None):
    """Deactivate any user. Returns where they were the only admin."""
    result = {
        "sole_admin_workspaces": sole_admin_workspaces(user),
        "sole_admin_projects": sole_admin_projects(user),
    }

    ProjectMember.objects.filter(member=user, is_active=True).update(is_active=False)
    WorkspaceMember.objects.filter(member=user, is_active=True).update(is_active=False)
    WorkspaceMemberInvite.objects.filter(email=user.email).delete()
    Session.objects.filter(user_id=str(user.id)).delete()
    reset_profile(user)

    user.is_password_autoset = True
    user.set_password(uuid.uuid4().hex)
    user.is_active = False
    user.last_logout_time = timezone.now()
    user.save()

    if current_site:
        user_deactivation_email.delay(current_site, user.id)
    return result


def reactivate_user(user):
    """Memberships stay inactive, the user has to be invited again."""
    if user.deleted_at:
        raise UserLifecycleError("A deleted user cannot be reactivated.")
    user.is_active = True
    user.save()
    return user


@transaction.atomic
def soft_delete_user(user, *, merged_into=None):
    """Deactivate and anonymise. The row stays so audit references remain valid."""
    if user.deleted_at:
        raise UserLifecycleError("The user is already deleted.")
    if user.is_bot:
        raise UserLifecycleError("Bots cannot be deleted here.")
    owned = list(Workspace.objects.filter(owner=user).values_list("slug", flat=True))
    if owned:
        raise UserLifecycleError(
            "Transfer ownership of the user's workspaces first.",
            owned_workspaces=owned,
        )

    deactivate_user(user)
    Account.objects.filter(user=user).delete()
    revoke_sessions_and_tokens(user)

    user.email = deleted_email(user.id)
    user.first_name = ""
    user.last_name = ""
    user.display_name = "Deleted user"
    user.avatar = ""
    user.avatar_asset = None
    user.cover_image = None
    user.cover_image_asset = None
    user.mobile_number = None
    user.is_email_verified = False
    user.deleted_at = timezone.now()
    user.merged_into = merged_into
    user.save()
    return user
