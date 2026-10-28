# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from plane.bgtasks.deletion_task import restore_related_objects, undelete
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, IssueType, State
from plane.utils.derived_properties import schedule_derived_refresh


def trashed_issues(slug, project_id):
    return Issue.all_objects.filter(workspace__slug=slug, project_id=project_id, deleted_at__isnull=False)


def listed_trashed_issues(slug, project_id):
    """Deleted issues as the trash lists them, newest first.

    Sub-items deleted along with their parent come back with it, so only the parent is listed.
    """
    return (
        trashed_issues(slug, project_id)
        .exclude(parent__deleted_at__lte=F("deleted_at"))
        .select_related("project")
        .order_by("-deleted_at")
    )


def restore_work_item(issue, actor_id):
    """Restore issue with everything its deletion removed. Returns an error message if it cannot be restored."""
    with transaction.atomic():
        error = _restore(issue)
    if error:
        return error
    issue_activity.delay(
        type="issue.activity.restored",
        requested_data=None,
        current_instance=None,
        issue_id=str(issue.id),
        actor_id=str(actor_id),
        project_id=str(issue.project_id),
        epoch=int(timezone.now().timestamp()),
    )
    return None


def _restore(issue):
    # An issue whose parent is still deleted comes back without a parent.
    if IssueType.all_objects.filter(pk=issue.type_id, deleted_at__isnull=False).exists():
        return "The work item type of this work item was deleted"
    changes = {}
    if issue.parent_id and Issue.all_objects.filter(pk=issue.parent_id, deleted_at__isnull=False).exists():
        changes["parent"] = None
    if not State.objects.filter(pk=issue.state_id).exists():
        states = State.objects.filter(~Q(is_triage=True), project_id=issue.project_id)
        changes["state"] = states.filter(default=True).first() or states.first()
    since = issue.deleted_at
    if not undelete(issue, **changes):
        return "Another work item has the same number"
    restore_related_objects(Issue, [issue.pk], since)
    schedule_derived_refresh(issue.project_id)
    return None
