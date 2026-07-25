# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Working out *which* automations an event or a schedule tick should run.

Kept separate from the Celery task so the mapping is unit testable without a
broker.
"""

# Django imports
from django.db.models import Q

# Module imports
from plane.automation.registry import ACTIONS, TriggerType
from plane.db.models import Automation, AutomationScope, Project

#: Coarse mapping from the `type` passed to `issue_activity` to the triggers it
#: can satisfy.
ACTIVITY_TYPE_TRIGGERS = {
    "issue.activity.created": [TriggerType.WORK_ITEM_CREATED],
    "issue.activity.updated": [TriggerType.WORK_ITEM_UPDATED],
    "issue.activity.deleted": [TriggerType.WORK_ITEM_DELETED],
    "comment.activity.created": [TriggerType.WORK_ITEM_COMMENT_CREATED],
    "cycle.activity.created": [TriggerType.WORK_ITEM_ADDED_TO_CYCLE],
    "module.activity.created": [TriggerType.WORK_ITEM_ADDED_TO_MODULE],
}

#: Field level triggers, derived from the `field` on the activity rows an update
#: produced. These are narrower than `work_item.updated`.
ACTIVITY_FIELD_TRIGGERS = {
    "state": TriggerType.WORK_ITEM_STATE_CHANGED,
    "priority": TriggerType.WORK_ITEM_PRIORITY_CHANGED,
    "assignees": TriggerType.WORK_ITEM_ASSIGNEES_CHANGED,
    "labels": TriggerType.WORK_ITEM_LABELS_CHANGED,
    "target_date": TriggerType.WORK_ITEM_TARGET_DATE_CHANGED,
    "parent": TriggerType.WORK_ITEM_PARENT_CHANGED,
}

SCHEDULED_TARGET_PROJECT = "project"
SCHEDULED_TARGET_WORK_ITEMS = "work_items"


def trigger_types_for_activity(activity_type: str, activities) -> set[str]:
    """
    Every trigger the activity satisfies.

    An update that changed the state satisfies both ``work_item.updated`` and
    ``work_item.state_changed``, so a rule on either fires.
    """
    triggers = {str(trigger) for trigger in ACTIVITY_TYPE_TRIGGERS.get(activity_type, [])}

    if activity_type == "issue.activity.updated":
        for activity in activities or []:
            field_trigger = ACTIVITY_FIELD_TRIGGERS.get(activity.get("field"))
            if field_trigger:
                triggers.add(str(field_trigger))

    return triggers


def candidate_automations(workspace_id, project_id, trigger_types):
    """
    Enabled automations that could fire for this project, in author order.

    Covers project scoped rules pinned to the project, and workspace scoped
    rules that either fan out to every project or list this one.
    """
    if not trigger_types:
        return Automation.objects.none()

    return (
        Automation.objects.filter(is_enabled=True, trigger_type__in=list(trigger_types))
        .filter(
            Q(scope=AutomationScope.PROJECT, project_id=project_id)
            | Q(
                scope=AutomationScope.WORKSPACE,
                workspace_id=workspace_id,
                applies_to_all_projects=True,
            )
            | Q(
                scope=AutomationScope.WORKSPACE,
                workspace_id=workspace_id,
                automation_projects__project_id=project_id,
                automation_projects__deleted_at__isnull=True,
            )
        )
        .distinct()
        .select_related("workspace")
        .prefetch_related("actions")
        .order_by("created_at")
    )


def due_scheduled_automations(now):
    """Enabled time based automations whose next run has come around."""
    return (
        Automation.objects.filter(
            is_enabled=True,
            trigger_type=TriggerType.SCHEDULE,
            next_run_at__isnull=False,
            next_run_at__lte=now,
        )
        .select_related("workspace")
        .prefetch_related("actions")
        .order_by("next_run_at")
    )


def target_projects(automation):
    """The projects a scheduled automation should sweep."""
    if automation.scope == AutomationScope.PROJECT:
        return Project.objects.filter(pk=automation.project_id)
    if automation.applies_to_all_projects:
        return Project.objects.filter(workspace_id=automation.workspace_id)
    return Project.objects.filter(
        workspace_id=automation.workspace_id,
        project_automation_links__automation_id=automation.id,
        project_automation_links__deleted_at__isnull=True,
    ).distinct()


def scheduled_target(automation) -> str:
    """
    Whether a scheduled run sweeps work items or fires once per project.

    Honours an explicit ``scheduled_target`` in the trigger config and otherwise
    infers it: a rule with no conditions whose actions all stand alone (create a
    work item, send a notification, call a webhook) runs once, everything else
    needs work items to act on.
    """
    configured = (automation.trigger_config or {}).get("scheduled_target")
    if configured in (SCHEDULED_TARGET_PROJECT, SCHEDULED_TARGET_WORK_ITEMS):
        return configured

    if automation.condition:
        return SCHEDULED_TARGET_WORK_ITEMS

    needs_entity = any(
        ACTIONS.get(action.action_type, {}).get("requires_entity") for action in automation.actions.all()
    )
    return SCHEDULED_TARGET_WORK_ITEMS if needs_entity else SCHEDULED_TARGET_PROJECT
