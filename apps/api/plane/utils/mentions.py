# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from django.db.models import Exists, OuterRef, Q

from plane.db.models import ProjectMember, User, WorkspaceMember
from plane.utils.permissions.base import ROLE

PUBLIC_NETWORK = 2


def mentionable_users(project):
    """Users who may be mentioned and notified in the project, annotated with is_project_member."""
    is_project_member = Exists(
        ProjectMember.objects.filter(project_id=project.id, member_id=OuterRef("pk"), is_active=True)
    )
    eligible = Q(is_project_member=True)
    if project.network == PUBLIC_NETWORK:
        eligible |= Exists(
            WorkspaceMember.objects.filter(
                workspace_id=project.workspace_id,
                member_id=OuterRef("pk"),
                is_active=True,
                role__gte=ROLE.MEMBER.value,
            )
        )
    return User.objects.annotate(is_project_member=is_project_member).filter(eligible)


def mentionable_user_ids(project, user_ids):
    """The subset of user_ids that may be notified for a mention in the project, as strings."""
    valid_ids = set()
    for user_id in user_ids:
        try:
            valid_ids.add(uuid.UUID(str(user_id)))
        except ValueError:
            continue
    if not valid_ids:
        return set()
    return {
        str(user_id) for user_id in mentionable_users(project).filter(pk__in=valid_ids).values_list("pk", flat=True)
    }
