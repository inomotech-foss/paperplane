# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Celery entry points for the automation engine.

* ``dispatch_work_item_automations`` - fired from ``issue_activity`` once the
  activity rows for a change exist.
* ``run_due_automations`` - beat task, every five minutes, for time based rules.
* ``run_automation_now`` - the designer's "Run now" button.
"""

# Python imports
import json
import logging

# Third party imports
from celery import shared_task

# Django imports
from django.utils import timezone

# Module imports
from plane.automation import dispatch, engine
from plane.automation.context import AutomationContext, changes_from_activities
from plane.automation.query import prefilter
from plane.automation.scheduling import ScheduleError, next_occurrence
from plane.db.models import (
    Automation,
    AutomationRun,
    AutomationRunTriggerSource,
    Issue,
    Project,
)
from plane.utils.exception_logger import log_exception

logger = logging.getLogger("plane.automation")

#: Cap on work items one scheduled sweep may act on, per project.
MAX_SCHEDULED_WORK_ITEMS = 500


@shared_task
def dispatch_work_item_automations(
    activity_type,
    issue_id,
    project_id,
    workspace_id,
    actor_id,
    activities=None,
    automation_context=None,
):
    """
    Run every event based automation that matches a work item change.

    ``automation_context`` carries the chain that produced this change (see
    ``engine.MAX_AUTOMATION_DEPTH``); it is ``None`` for human actions.
    """
    try:
        activities = json.loads(activities) if isinstance(activities, str) else (activities or [])
        automation_context = automation_context or {}
        depth = int(automation_context.get("depth", 0))
        ancestors = automation_context.get("automation_ids") or []

        trigger_types = dispatch.trigger_types_for_activity(activity_type, activities)
        if not trigger_types:
            return

        automations = dispatch.candidate_automations(workspace_id, project_id, trigger_types)
        if not automations:
            return

        project = Project.objects.filter(pk=project_id).select_related("workspace").first()
        if project is None:
            return

        # A deleted work item has no row left to load; the trigger still fires so
        # notification and webhook actions can announce it.
        work_item = None
        if activity_type != "issue.activity.deleted":
            work_item = (
                Issue.objects.filter(pk=issue_id, project_id=project_id)
                .select_related("state", "project", "created_by")
                .first()
            )
            if work_item is None:
                return
            # Drafts are not real work items yet.
            if work_item.is_draft:
                return

        changes = changes_from_activities(activities)

        for automation in automations:
            # Each automation gets its own context so one rule's mutations are
            # visible to the next, but cached lookups don't leak stale values.
            context = AutomationContext(
                work_item=work_item,
                project=project,
                actor_id=actor_id,
                changes=changes,
                trigger_type=automation.trigger_type,
                automation=automation,
            )
            try:
                engine.execute(
                    automation,
                    context,
                    trigger_source=AutomationRunTriggerSource.EVENT,
                    depth=depth,
                    ancestor_automation_ids=ancestors,
                )
            except Exception as exception:  # noqa: BLE001 - one rule must not stop the rest
                log_exception(exception)
    except Exception as exception:  # noqa: BLE001
        log_exception(exception)
        return


def _sweep_work_items(automation, project, initiator_id=None):
    """Run a scheduled automation against every matching work item in a project."""
    reference = AutomationContext(project=project, automation=automation)
    today = reference.today

    queryset = (
        Issue.issue_objects.filter(project_id=project.id)
        .filter(prefilter(automation.condition, today, timezone.now()))
        .select_related("state", "project", "created_by")
        .order_by("created_at")
    )

    processed = 0
    matched = 0
    for work_item in queryset.iterator(chunk_size=200):
        if matched >= MAX_SCHEDULED_WORK_ITEMS:
            logger.warning(
                "Automation %s hit the per-project sweep cap of %s work items in project %s",
                automation.id,
                MAX_SCHEDULED_WORK_ITEMS,
                project.id,
            )
            break
        processed += 1
        context = AutomationContext(
            work_item=work_item,
            project=project,
            changes={},
            trigger_type=automation.trigger_type,
            automation=automation,
        )
        if not engine.matches(automation, context):
            continue
        matched += 1
        engine.execute(
            automation,
            context,
            trigger_source=AutomationRunTriggerSource.SCHEDULE,
            initiator_id=initiator_id,
        )
    return processed, matched


def _run_scheduled_automation(automation, initiator_id=None, trigger_source=AutomationRunTriggerSource.SCHEDULE):
    """Execute one time based automation across its target projects."""
    target = dispatch.scheduled_target(automation)
    projects = dispatch.target_projects(automation).select_related("workspace")

    for project in projects:
        if target == dispatch.SCHEDULED_TARGET_PROJECT:
            context = AutomationContext(
                project=project,
                changes={},
                trigger_type=automation.trigger_type,
                automation=automation,
            )
            engine.execute(
                automation,
                context,
                trigger_source=trigger_source,
                initiator_id=initiator_id,
            )
        else:
            _sweep_work_items(automation, project, initiator_id=initiator_id)


def reschedule(automation, after=None) -> None:
    """
    Recompute ``next_run_at``. A schedule that can never fire disables itself
    rather than being retried every tick.
    """
    try:
        automation.next_run_at = next_occurrence(automation.trigger_config, after=after)
    except ScheduleError as exception:
        logger.warning("Automation %s has an unusable schedule: %s", automation.id, exception)
        automation.next_run_at = None
    automation.save(update_fields=["next_run_at", "updated_at"], disable_auto_set_user=True)


@shared_task
def run_due_automations():
    """Beat task: run every time based automation whose next run has arrived."""
    now = timezone.now()
    for automation in dispatch.due_scheduled_automations(now):
        try:
            # Move the cursor forward first so a crash mid-run cannot make the
            # automation fire again on the next tick.
            reschedule(automation, after=now)
            _run_scheduled_automation(automation)
        except Exception as exception:  # noqa: BLE001 - keep going through the queue
            log_exception(exception)
    return


@shared_task
def run_automation_now(automation_id, user_id=None):
    """Run an automation on demand, regardless of its trigger type."""
    try:
        automation = (
            Automation.objects.filter(pk=automation_id, is_enabled=True)
            .select_related("workspace")
            .prefetch_related("actions")
            .first()
        )
        if automation is None:
            return

        if automation.trigger_type == "schedule":
            _run_scheduled_automation(
                automation,
                initiator_id=user_id,
                trigger_source=AutomationRunTriggerSource.MANUAL,
            )
            return

        # Event based rules have no event to replay, so a manual run sweeps the
        # work items its conditions describe.
        for project in dispatch.target_projects(automation).select_related("workspace"):
            _sweep_work_items(automation, project, initiator_id=user_id)
    except Exception as exception:  # noqa: BLE001
        log_exception(exception)
        return


@shared_task
def trim_automation_run_history():
    """Keep the newest ``engine.RUN_HISTORY_LIMIT`` runs per automation."""
    try:
        automation_ids = AutomationRun.objects.values_list("automation_id", flat=True).distinct()
        for automation_id in automation_ids:
            keep = list(
                AutomationRun.objects.filter(automation_id=automation_id)
                .order_by("-started_at")
                .values_list("id", flat=True)[: engine.RUN_HISTORY_LIMIT]
            )
            AutomationRun.objects.filter(automation_id=automation_id).exclude(id__in=keep).delete(soft=False)
    except Exception as exception:  # noqa: BLE001
        log_exception(exception)
        return
