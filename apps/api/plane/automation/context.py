# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
The evaluation context handed to condition evaluation, template rendering and
action handlers.

Property lookups are lazy: a rule that only filters on ``priority`` never pays
for the assignee or module queries.
"""

# Python imports
import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Django imports
from django.utils import timezone

#: Activity `field` values mapped onto the condition property they change.
ACTIVITY_FIELD_TO_PROPERTY = {
    "state": "state_id",
    "priority": "priority",
    "assignees": "assignee_ids",
    "labels": "label_ids",
    "target_date": "target_date",
    "start_date": "start_date",
    "parent": "parent_id",
    "estimate_point": "estimate_point_id",
    "cycles": "cycle_id",
    "modules": "module_ids",
    "name": "name",
    "description": "description",
    "archived_at": "is_archived",
}


def resolve_timezone(name: str | None) -> datetime.tzinfo:
    """Best-effort tzinfo lookup that never raises on stale saved values."""
    if not name:
        return datetime.UTC
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.UTC


class AutomationContext:
    """
    Snapshot of one work item (or a bare project, for entity-less scheduled
    runs) plus the change set that triggered the automation.
    """

    def __init__(self, work_item=None, project=None, actor_id=None, changes=None, trigger_type="", automation=None):
        self.work_item = work_item
        self.project = project or (work_item.project if work_item else None)
        self.actor_id = actor_id
        self.changes = changes or {}
        self.trigger_type = trigger_type
        self.automation = automation
        self._cache: dict[str, object] = {}

    # -- time helpers ----------------------------------------------------

    @property
    def tzinfo(self) -> datetime.tzinfo:
        return resolve_timezone(getattr(self.project, "timezone", None))

    @property
    def now(self) -> datetime.datetime:
        return timezone.now().astimezone(self.tzinfo)

    @property
    def today(self) -> datetime.date:
        return self.now.date()

    # -- property access -------------------------------------------------

    def get(self, property_key: str):
        if property_key in self._cache:
            return self._cache[property_key]
        value = self._resolve(property_key)
        self._cache[property_key] = value
        return value

    def _resolve(self, property_key: str):
        work_item = self.work_item

        if property_key == "actor_id":
            return self.actor_id
        if property_key == "project_id":
            return getattr(self.project, "id", None)

        if work_item is None:
            return None

        simple_fields = {
            "state_id": "state_id",
            "priority": "priority",
            "type_id": "type_id",
            "created_by_id": "created_by_id",
            "parent_id": "parent_id",
            "estimate_point_id": "estimate_point_id",
            "name": "name",
            "target_date": "target_date",
            "start_date": "start_date",
            "created_at": "created_at",
            "updated_at": "updated_at",
            "sequence_id": "sequence_id",
        }
        if property_key in simple_fields:
            return getattr(work_item, simple_fields[property_key], None)

        if property_key == "description":
            return work_item.description_stripped or ""
        if property_key == "is_archived":
            return work_item.archived_at is not None
        if property_key == "state_group":
            return work_item.state.group if work_item.state_id else None
        if property_key == "assignee_ids":
            return list(work_item.assignees.values_list("id", flat=True))
        if property_key == "label_ids":
            return list(work_item.labels.values_list("id", flat=True))
        if property_key == "module_ids":
            return list(
                work_item.issue_module.filter(module__deleted_at__isnull=True).values_list("module_id", flat=True)
            )
        if property_key == "cycle_id":
            link = (
                work_item.issue_cycle.filter(cycle__deleted_at__isnull=True).values_list("cycle_id", flat=True).first()
            )
            return link
        if property_key == "sub_work_item_count":
            return work_item.parent_issue.filter(deleted_at__isnull=True).count()

        return None

    def invalidate(self, *property_keys: str) -> None:
        """Drop cached values after an action mutates the work item."""
        if not property_keys:
            self._cache.clear()
            return
        for key in property_keys:
            self._cache.pop(key, None)


def changes_from_activities(activities) -> dict:
    """
    Fold serialized ``IssueActivity`` rows into a
    ``{property_key: {"old": ..., "new": ...}}`` map for the change-aware
    operators.

    Multi-value fields (assignees, labels, modules) produce one activity row per
    added or removed item, so their old/new sides accumulate into lists.
    """
    changes: dict[str, dict] = {}
    for activity in activities or []:
        field = activity.get("field")
        if not field:
            continue
        property_key = ACTIVITY_FIELD_TO_PROPERTY.get(field, field)

        old_value = activity.get("old_identifier") or activity.get("old_value")
        new_value = activity.get("new_identifier") or activity.get("new_value")

        entry = changes.setdefault(property_key, {"old": [], "new": []})
        if old_value not in (None, ""):
            entry["old"].append(old_value)
        if new_value not in (None, ""):
            entry["new"].append(new_value)
    return changes
