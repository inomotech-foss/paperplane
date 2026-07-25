# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Running an automation: evaluate the condition, execute the actions in order,
and record what happened.

Loop protection lives here. Every mutation an action makes is tagged with the
chain of automations that led to it (``depth`` plus ``ancestor_automation_ids``),
so an automation can neither re-trigger itself nor bounce off a second rule
indefinitely.
"""

# Python imports
import logging
import time

# Django imports
from django.db import transaction
from django.utils import timezone

# Module imports
from plane.automation import conditions
from plane.automation.actions import ActionError, get_handler
from plane.automation.registry import ACTIONS, allowed_actions_for_trigger
from plane.db.models import AutomationRun, AutomationRunStatus, AutomationRunTriggerSource
from plane.utils.exception_logger import log_exception

logger = logging.getLogger("plane.automation")

#: How many automations may fire in a single causal chain. A change made by
#: automation A can trigger B, and B can trigger C, but there it stops.
MAX_AUTOMATION_DEPTH = 3

#: Keep the run history bounded per automation; older rows are trimmed by the
#: cleanup task.
RUN_HISTORY_LIMIT = 200


class RunHandle:
    """
    Mutable bookkeeping for one execution, handed to each action handler.

    ``actor_id`` is the user every change is attributed to: the automation's
    owner, so the activity feed and notifications have a real person to point at.
    """

    def __init__(self, automation, actor_id, depth=0, ancestor_automation_ids=None):
        self.automation = automation
        self.actor_id = actor_id
        self.depth = depth
        self.ancestor_automation_ids = list(ancestor_automation_ids or [])


def should_skip_for_loop_protection(automation, depth: int, ancestor_automation_ids) -> str | None:
    """Return a reason to skip, or ``None`` to proceed."""
    if depth >= MAX_AUTOMATION_DEPTH:
        return f"Automation chain reached the depth limit of {MAX_AUTOMATION_DEPTH}."
    if str(automation.id) in {str(value) for value in ancestor_automation_ids or []}:
        return "This automation already ran earlier in the same chain."
    return None


def matches(automation, context) -> bool:
    """Whether the automation's condition tree accepts this context."""
    return conditions.evaluate(automation.condition, context)


def _executable_actions(automation):
    """
    Actions in author order, dropping any that the trigger cannot support (for
    example mutating a work item that was just deleted).
    """
    allowed = set(allowed_actions_for_trigger(automation.trigger_type))
    return [action for action in automation.actions.all().order_by("sort_order") if action.action_type in allowed]


def execute(
    automation,
    context,
    trigger_source=AutomationRunTriggerSource.EVENT,
    initiator_id=None,
    depth=0,
    ancestor_automation_ids=None,
    record_skips=False,
):
    """
    Run one automation against one context.

    Returns the persisted ``AutomationRun``, or ``None`` when nothing ran and
    there was nothing worth recording.
    """
    skip_reason = should_skip_for_loop_protection(automation, depth, ancestor_automation_ids)
    if skip_reason:
        logger.info("Skipping automation %s: %s", automation.id, skip_reason)
        return None

    if not matches(automation, context):
        if not record_skips:
            return None
        return _persist_run(
            automation=automation,
            context=context,
            trigger_source=trigger_source,
            initiator_id=initiator_id,
            status=AutomationRunStatus.SKIPPED,
            steps=[],
            error="",
            started_at=timezone.now(),
            duration_ms=0,
            processed_count=0,
        )

    actions = _executable_actions(automation)
    if not actions:
        return None

    run = RunHandle(
        automation=automation,
        actor_id=automation.owned_by_id,
        depth=depth,
        ancestor_automation_ids=ancestor_automation_ids,
    )

    started_at = timezone.now()
    started_monotonic = time.monotonic()
    steps = []
    failures = 0

    for action in actions:
        handler = get_handler(action.action_type)
        if handler is None:
            steps.append(
                {
                    "action_id": str(action.id),
                    "action_type": action.action_type,
                    "status": "failed",
                    "detail": "",
                    "error": f"'{action.action_type}' is not a known action.",
                }
            )
            failures += 1
            continue

        # Entity-bound actions cannot run without a work item; a scheduled rule
        # with no conditions has none, which is an author mistake worth showing.
        if ACTIONS[action.action_type]["requires_entity"] and context.work_item is None:
            steps.append(
                {
                    "action_id": str(action.id),
                    "action_type": action.action_type,
                    "status": "skipped",
                    "detail": "",
                    "error": "This action needs a work item, and this run has none.",
                }
            )
            continue

        try:
            steps.append(handler(action, context, run))
        except ActionError as exception:
            steps.append(
                {
                    "action_id": str(action.id),
                    "action_type": action.action_type,
                    "status": "failed",
                    "detail": "",
                    "error": str(exception),
                }
            )
            failures += 1
        except Exception as exception:  # noqa: BLE001 - one bad action must not kill the rest
            log_exception(exception)
            steps.append(
                {
                    "action_id": str(action.id),
                    "action_type": action.action_type,
                    "status": "failed",
                    "detail": "",
                    "error": "Something went wrong while running this action.",
                }
            )
            failures += 1

    duration_ms = int((time.monotonic() - started_monotonic) * 1000)

    attempted = [step for step in steps if step["status"] != "skipped"]
    if not attempted:
        status = AutomationRunStatus.SKIPPED
    elif failures == 0:
        status = AutomationRunStatus.SUCCESS
    elif failures == len(attempted):
        status = AutomationRunStatus.FAILED
    else:
        status = AutomationRunStatus.PARTIAL

    return _persist_run(
        automation=automation,
        context=context,
        trigger_source=trigger_source,
        initiator_id=initiator_id,
        status=status,
        steps=steps,
        error="",
        started_at=started_at,
        duration_ms=duration_ms,
        processed_count=1 if context.work_item is not None else 0,
    )


def _persist_run(
    automation,
    context,
    trigger_source,
    initiator_id,
    status,
    steps,
    error,
    started_at,
    duration_ms,
    processed_count,
):
    finished_at = timezone.now()
    work_item = context.work_item

    with transaction.atomic():
        run = AutomationRun.objects.create(
            workspace_id=automation.workspace_id,
            project_id=getattr(context.project, "id", None),
            automation=automation,
            status=status,
            trigger_source=trigger_source,
            trigger_type=automation.trigger_type,
            entity_type="work_item" if work_item is not None else "",
            entity_identifier=work_item.id if work_item is not None else None,
            initiator_id=initiator_id,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
            processed_count=processed_count,
            steps=steps,
            error=error,
            created_by_id=automation.owned_by_id,
        )

        # Statistics are denormalised so the list view stays one query. `skipped`
        # runs are recorded but don't count as executions.
        if status != AutomationRunStatus.SKIPPED:
            automation.total_run_count += 1
            automation.total_duration_ms += duration_ms
            if status == AutomationRunStatus.FAILED:
                automation.failed_run_count += 1
            automation.last_run_at = finished_at
            automation.last_run_status = status
            automation.save(
                update_fields=[
                    "total_run_count",
                    "total_duration_ms",
                    "failed_run_count",
                    "last_run_at",
                    "last_run_status",
                    "updated_at",
                ],
                disable_auto_set_user=True,
            )

    return run
