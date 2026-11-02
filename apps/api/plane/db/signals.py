# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models.signals import post_delete, post_save

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember
from plane.utils.live_access import notify_live_access_changed

# The fields that page live access depends on, and the open sessions a change to them affects.
LIVE_ACCESS_INPUTS = {
    Page: (Page.TRACKED_FIELDS, lambda page: {"page": page.id}),
    ProjectPage: (ProjectPage.TRACKED_FIELDS, lambda link: {"page": link.page_id}),
    Project: (["guest_view_all_features", "deleted_at"], lambda project: {"project": project.id}),
    ProjectMember: (
        ProjectMember.TRACKED_FIELDS,
        lambda member: {"project": member.project_id, "user": member.member_id},
    ),
    WorkspaceMember: (WorkspaceMember.TRACKED_FIELDS, lambda member: {"user": member.member_id}),
    User: (User.TRACKED_FIELDS, lambda user: {"user": user.id}),
}


def _on_save(sender, instance, created, **kwargs):
    fields, scope = LIVE_ACCESS_INPUTS[sender]
    if not created and set(fields) & set(getattr(instance, "_changes_on_save", ())):
        notify_live_access_changed(**scope(instance))


def _on_delete(sender, instance, **kwargs):
    notify_live_access_changed(**LIVE_ACCESS_INPUTS[sender][1](instance))


def connect_live_access_signals():
    for model in LIVE_ACCESS_INPUTS:
        post_save.connect(_on_save, sender=model, dispatch_uid=f"live_access_save_{model.__name__}")
        post_delete.connect(_on_delete, sender=model, dispatch_uid=f"live_access_delete_{model.__name__}")
