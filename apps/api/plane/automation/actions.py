# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Action handlers.

Every handler takes ``(action, context, run)`` and returns a step result dict
that lands in ``AutomationRun.steps``. Handlers raise ``ActionError`` for
author mistakes (bad config, missing target) and let unexpected exceptions
bubble so the engine records them as failures.

Mutating handlers log ``issue_activity`` exactly like the REST views do, but
tag the call with ``automation_context`` so the dispatcher can tell an
automation-caused change from a human one and stop rules re-triggering each
other forever.
"""

# Python imports
import datetime
import json
import uuid

# Third party imports
import requests

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

# Module imports
from plane.automation.registry import ActionType, NOTIFICATION_RECIPIENTS
from plane.automation.templating import render, render_html
from plane.db.models import (
    CycleIssue,
    Issue,
    IssueAssignee,
    IssueComment,
    IssueLabel,
    IssueSubscriber,
    Label,
    ModuleIssue,
    Notification,
    Project,
    ProjectMember,
    State,
)
from plane.db.models.project import ROLE
from plane.utils.url_security import pinned_fetch

#: Guard against a webhook action stalling a worker.
WEBHOOK_TIMEOUT_SECONDS = 10

#: Where a mutable property's name differs from the key `update_issue_activity`
#: dispatches on. Anything not listed here uses the property name as-is.
ACTIVITY_KEY_FOR_PROPERTY = {"estimate_point_id": "estimate_point"}


class ActionError(Exception):
    """A configuration or target problem that makes an action impossible."""


def _step(action, status, detail="", error=""):
    return {
        "action_id": str(action.id),
        "action_type": action.action_type,
        "status": status,
        "detail": detail,
        "error": error,
    }


def _uuid_list(values) -> list[str]:
    """
    Normalise an id or list of ids, dropping anything unparseable.

    Single-select pickers send a bare string, so a scalar is wrapped rather than
    iterated - otherwise a UUID string would be walked character by character and
    silently yield nothing.
    """
    if values is None:
        return []
    if isinstance(values, (str, uuid.UUID)):
        values = [values]
    elif not isinstance(values, (list, tuple, set)):
        return []

    result = []
    for value in values:
        try:
            result.append(str(uuid.UUID(str(value))))
        except (ValueError, TypeError, AttributeError):
            continue
    return result


def _resolve_date(value, context):
    """
    Accept an absolute ISO date or a relative spec such as
    ``{"mode": "relative", "days": 3}`` (three days from the run date).
    """
    if value in (None, ""):
        return None
    if isinstance(value, dict):
        if value.get("mode") == "relative":
            try:
                days = int(value.get("days", 0))
            except (TypeError, ValueError) as exception:
                raise ActionError("Relative date offsets must be whole numbers.") from exception
            return context.today + datetime.timedelta(days=days)
        raise ActionError("Unsupported date specification.")
    try:
        return datetime.date.fromisoformat(str(value)[:10])
    except ValueError as exception:
        raise ActionError(f"'{value}' is not a valid date.") from exception


def _log_issue_activity(context, run, requested_data, current_instance, activity_type="issue.activity.updated"):
    """Queue an activity entry tagged with the automation lineage."""
    # Imported lazily: issue_activities_task imports models at module scope and
    # a top-level import here creates a cycle through plane.db.
    from plane.bgtasks.issue_activities_task import issue_activity

    issue_activity.delay(
        type=activity_type,
        requested_data=json.dumps(requested_data, cls=DjangoJSONEncoder),
        actor_id=str(run.actor_id) if run.actor_id else None,
        issue_id=str(context.work_item.id),
        project_id=str(context.project.id),
        current_instance=json.dumps(current_instance, cls=DjangoJSONEncoder),
        epoch=int(timezone.now().timestamp()),
        notification=True,
        automation_context={
            "depth": run.depth + 1,
            "automation_ids": [*run.ancestor_automation_ids, str(run.automation.id)],
        },
    )


# ---------------------------------------------------------------------------
# change_property
# ---------------------------------------------------------------------------


def _apply_scalar_change(work_item, property_key, change_type, value, context):
    """Set or clear a column on the work item. Returns (before, after)."""
    if change_type == "clear":
        new_value = None
    elif property_key in ("target_date", "start_date"):
        if change_type == "shift_days":
            current = getattr(work_item, property_key)
            if current is None:
                raise ActionError("There is no date to shift.")
            try:
                days = int(value)
            except (TypeError, ValueError) as exception:
                raise ActionError("The number of days to shift must be a whole number.") from exception
            new_value = current + datetime.timedelta(days=days)
        else:
            new_value = _resolve_date(value, context)
    elif property_key == "priority":
        valid = {choice for choice, _ in Issue.PRIORITY_CHOICES}
        if value not in valid:
            raise ActionError(f"'{value}' is not a valid priority.")
        new_value = value
    elif property_key == "state_id":
        state_id = str(value) if value else None
        if state_id and not State.objects.filter(pk=state_id, project_id=work_item.project_id).exists():
            raise ActionError("The selected state does not belong to this project.")
        new_value = state_id
    else:
        new_value = str(value) if value else None

    field = "state_id" if property_key == "state_id" else property_key
    before = getattr(work_item, field)
    if str(before or "") == str(new_value or ""):
        return before, before

    setattr(work_item, field, new_value)
    work_item.save(update_fields=[field, "updated_at"])
    return before, new_value


def _apply_assignee_change(work_item, change_type, value, run):
    before = set(str(pk) for pk in work_item.assignees.values_list("id", flat=True))
    requested = set(_uuid_list(value))

    # Only members of the project may be assigned.
    if requested:
        allowed = set(
            str(pk)
            for pk in ProjectMember.objects.filter(
                project_id=work_item.project_id, member_id__in=requested, is_active=True
            ).values_list("member_id", flat=True)
        )
        requested = requested & allowed

    if change_type == "set":
        after = requested
    elif change_type == "add":
        after = before | requested
    elif change_type == "remove":
        after = before - requested
    else:  # clear
        after = set()

    if after == before:
        return before, after

    IssueAssignee.objects.filter(issue=work_item, assignee_id__in=before - after).delete()
    IssueAssignee.objects.bulk_create(
        [
            IssueAssignee(
                issue=work_item,
                assignee_id=member_id,
                project_id=work_item.project_id,
                workspace_id=work_item.workspace_id,
                created_by_id=run.actor_id,
            )
            for member_id in after - before
        ],
        batch_size=100,
        ignore_conflicts=True,
    )
    return before, after


def _apply_label_change(work_item, change_type, value, run):
    before = set(str(pk) for pk in work_item.labels.values_list("id", flat=True))
    requested = set(_uuid_list(value))

    if requested:
        allowed = set(
            str(pk)
            for pk in Label.objects.filter(pk__in=requested, project_id=work_item.project_id).values_list(
                "id", flat=True
            )
        )
        requested = requested & allowed

    if change_type == "set":
        after = requested
    elif change_type == "add":
        after = before | requested
    elif change_type == "remove":
        after = before - requested
    else:  # clear
        after = set()

    if after == before:
        return before, after

    IssueLabel.objects.filter(issue=work_item, label_id__in=before - after).delete()
    IssueLabel.objects.bulk_create(
        [
            IssueLabel(
                issue=work_item,
                label_id=label_id,
                project_id=work_item.project_id,
                workspace_id=work_item.workspace_id,
                created_by_id=run.actor_id,
            )
            for label_id in after - before
        ],
        batch_size=100,
        ignore_conflicts=True,
    )
    return before, after


def _apply_module_change(work_item, change_type, value, run):
    requested = _uuid_list(value)
    if not requested:
        raise ActionError("Pick at least one module.")

    if change_type == "remove":
        removed = ModuleIssue.objects.filter(issue=work_item, module_id__in=requested).delete()
        return f"removed from {removed[0]} module(s)"

    existing = set(
        str(pk)
        for pk in ModuleIssue.objects.filter(issue=work_item, module_id__in=requested).values_list(
            "module_id", flat=True
        )
    )
    to_add = [module_id for module_id in requested if module_id not in existing]
    ModuleIssue.objects.bulk_create(
        [
            ModuleIssue(
                issue=work_item,
                module_id=module_id,
                project_id=work_item.project_id,
                workspace_id=work_item.workspace_id,
                created_by_id=run.actor_id,
            )
            for module_id in to_add
        ],
        batch_size=100,
        ignore_conflicts=True,
    )
    return f"added to {len(to_add)} module(s)"


def _apply_cycle_change(work_item, change_type, value, run):
    if change_type == "clear":
        removed = CycleIssue.objects.filter(issue=work_item).delete()
        return "removed from cycle" if removed[0] else "no cycle to remove"

    cycle_ids = _uuid_list(value)
    if not cycle_ids:
        raise ActionError("Pick a cycle.")
    cycle_id = cycle_ids[0]

    CycleIssue.objects.filter(issue=work_item).exclude(cycle_id=cycle_id).delete()
    CycleIssue.objects.get_or_create(
        issue=work_item,
        cycle_id=cycle_id,
        defaults={
            "project_id": work_item.project_id,
            "workspace_id": work_item.workspace_id,
            "created_by_id": run.actor_id,
        },
    )
    return "moved to cycle"


def handle_change_property(action, context, run):
    work_item = context.work_item
    if work_item is None:
        raise ActionError("This action needs a work item to act on.")

    config = action.config or {}
    property_key = config.get("property")
    change_type = config.get("change_type", "set")
    value = config.get("value")

    if not property_key:
        raise ActionError("No property selected.")

    if property_key == "assignee_ids":
        before, after = _apply_assignee_change(work_item, change_type, value, run)
        if before == after:
            return _step(action, "skipped", "Assignees already match.")
        _log_issue_activity(
            context,
            run,
            {"assignee_ids": sorted(after)},
            {"assignee_ids": sorted(before)},
        )
        context.invalidate("assignee_ids")
        return _step(action, "success", f"Assignees set to {len(after)} member(s).")

    if property_key == "label_ids":
        before, after = _apply_label_change(work_item, change_type, value, run)
        if before == after:
            return _step(action, "skipped", "Labels already match.")
        _log_issue_activity(
            context,
            run,
            {"label_ids": sorted(after)},
            {"label_ids": sorted(before)},
        )
        context.invalidate("label_ids")
        return _step(action, "success", f"Labels set to {len(after)} label(s).")

    if property_key == "module_ids":
        detail = _apply_module_change(work_item, change_type, value, run)
        context.invalidate("module_ids")
        return _step(action, "success", detail)

    if property_key == "cycle_id":
        detail = _apply_cycle_change(work_item, change_type, value, run)
        context.invalidate("cycle_id")
        return _step(action, "success", detail)

    before, after = _apply_scalar_change(work_item, property_key, change_type, value, context)
    if before == after:
        return _step(action, "skipped", f"{property_key} already set to the target value.")

    activity_key = ACTIVITY_KEY_FOR_PROPERTY.get(property_key, property_key)
    # `track_estimate_points` dereferences the new estimate unconditionally, so
    # clearing one would raise inside the activity task. Skip the feed entry
    # rather than queue a call that is guaranteed to fail.
    if not (activity_key == "estimate_point" and after is None):
        _log_issue_activity(context, run, {activity_key: after}, {activity_key: before})
    context.invalidate(property_key, "state_group")
    return _step(action, "success", f"{property_key} updated.")


# ---------------------------------------------------------------------------
# add_comment
# ---------------------------------------------------------------------------


def handle_add_comment(action, context, run):
    work_item = context.work_item
    if work_item is None:
        raise ActionError("This action needs a work item to comment on.")

    template = (action.config or {}).get("comment_html") or ""
    if not template.strip():
        raise ActionError("The comment body is empty.")

    comment_html = render_html(template, context)
    comment = IssueComment.objects.create(
        issue=work_item,
        project_id=work_item.project_id,
        workspace_id=work_item.workspace_id,
        comment_html=comment_html,
        actor_id=run.actor_id,
        created_by_id=run.actor_id,
    )

    from plane.bgtasks.issue_activities_task import issue_activity

    issue_activity.delay(
        type="comment.activity.created",
        requested_data=json.dumps({"id": str(comment.id), "comment_html": comment_html}, cls=DjangoJSONEncoder),
        actor_id=str(run.actor_id) if run.actor_id else None,
        issue_id=str(work_item.id),
        project_id=str(work_item.project_id),
        current_instance=None,
        epoch=int(timezone.now().timestamp()),
        notification=True,
        automation_context={
            "depth": run.depth + 1,
            "automation_ids": [*run.ancestor_automation_ids, str(run.automation.id)],
        },
    )
    return _step(action, "success", "Comment added.")


# ---------------------------------------------------------------------------
# send_notification
# ---------------------------------------------------------------------------


def _resolve_recipients(config, context, run) -> set[str]:
    groups = config.get("recipients") or []
    unknown = [group for group in groups if group not in NOTIFICATION_RECIPIENTS]
    if unknown:
        raise ActionError(f"Unknown recipient group(s): {', '.join(unknown)}.")

    work_item = context.work_item
    receivers: set[str] = set()

    for group in groups:
        if group == "assignees" and work_item is not None:
            receivers |= {str(pk) for pk in work_item.assignees.values_list("id", flat=True)}
        elif group == "created_by" and work_item is not None and work_item.created_by_id:
            receivers.add(str(work_item.created_by_id))
        elif group == "actor" and context.actor_id:
            receivers.add(str(context.actor_id))
        elif group == "subscribers" and work_item is not None:
            receivers |= {
                str(pk)
                for pk in IssueSubscriber.objects.filter(issue=work_item).values_list("subscriber_id", flat=True)
            }
        elif group == "project_admins" and context.project is not None:
            receivers |= {
                str(pk)
                for pk in ProjectMember.objects.filter(
                    project_id=context.project.id, role=ROLE.ADMIN.value, is_active=True
                ).values_list("member_id", flat=True)
            }
        elif group == "specific_members":
            receivers |= set(_uuid_list(config.get("member_ids")))

    if not receivers:
        return receivers

    # Never notify someone who has lost access to the project.
    if context.project is not None:
        active = {
            str(pk)
            for pk in ProjectMember.objects.filter(
                project_id=context.project.id, member_id__in=receivers, is_active=True
            ).values_list("member_id", flat=True)
        }
        receivers &= active

    # A rule notifying "whoever made the change" would otherwise ping the bot.
    if run.actor_id:
        receivers.discard(str(run.actor_id))

    return receivers


def handle_send_notification(action, context, run):
    config = action.config or {}
    receivers = _resolve_recipients(config, context, run)
    if not receivers:
        return _step(action, "skipped", "No eligible recipients.")

    title = render(config.get("title") or run.automation.name, context)
    message = render(config.get("message") or "", context)

    work_item = context.work_item
    data = {"automation": {"id": str(run.automation.id), "name": run.automation.name}}
    if work_item is not None:
        data["issue"] = {
            "id": str(work_item.id),
            "name": work_item.name,
            "identifier": context.project.identifier,
            "sequence_id": work_item.sequence_id,
            "state_name": getattr(work_item.state, "name", None),
            "state_group": getattr(work_item.state, "group", None),
        }
        # The notification card reads `issue_activity` for its body copy.
        data["issue_activity"] = {
            "id": None,
            "verb": "updated",
            "field": None,
            "actor": str(run.actor_id) if run.actor_id else None,
            "new_value": message,
            "old_value": "",
        }

    Notification.objects.bulk_create(
        [
            Notification(
                workspace_id=context.project.workspace_id,
                project_id=context.project.id,
                sender=f"in_app:automation:{run.automation.id}",
                triggered_by_id=run.actor_id,
                receiver_id=receiver_id,
                entity_identifier=work_item.id if work_item is not None else run.automation.id,
                entity_name="issue" if work_item is not None else "automation",
                title=title,
                message_stripped=message,
                data=data,
            )
            for receiver_id in receivers
        ],
        batch_size=100,
    )
    return _step(action, "success", f"Notified {len(receivers)} member(s).")


# ---------------------------------------------------------------------------
# create_work_item
# ---------------------------------------------------------------------------


def handle_create_work_item(action, context, run):
    config = action.config or {}

    name_template = config.get("name") or ""
    name = render(name_template, context).strip()
    if not name:
        raise ActionError("The new work item needs a name.")
    name = name[:255]

    # Default to the project the automation ran for; workspace scoped rules may
    # target a fixed project instead.
    project_id = config.get("project_id") or (context.project.id if context.project else None)
    if not project_id:
        raise ActionError("No target project for the new work item.")
    project = Project.objects.filter(pk=project_id).first()
    if project is None:
        raise ActionError("The target project no longer exists.")
    if context.project is not None and project.workspace_id != context.project.workspace_id:
        raise ActionError("The target project is in a different workspace.")

    state_id = config.get("state_id")
    if state_id and not State.objects.filter(pk=state_id, project_id=project.id).exists():
        raise ActionError("The selected state does not belong to the target project.")

    priority = config.get("priority") or "none"
    if priority not in {choice for choice, _ in Issue.PRIORITY_CHOICES}:
        raise ActionError(f"'{priority}' is not a valid priority.")

    target_date = None
    if config.get("target_date") is not None:
        target_date = _resolve_date(config.get("target_date"), context)

    description_html = render_html(config.get("description_html") or "<p></p>", context)

    parent_id = None
    if config.get("link_to_trigger_work_item") and context.work_item is not None:
        # Only valid inside the same project; Plane sub-items cannot cross projects.
        if context.work_item.project_id == project.id:
            parent_id = context.work_item.id

    work_item = Issue.objects.create(
        project=project,
        name=name,
        description_html=description_html,
        priority=priority,
        state_id=state_id or None,
        target_date=target_date,
        parent_id=parent_id,
        created_by_id=run.actor_id,
    )

    assignee_ids = _uuid_list(config.get("assignee_ids"))
    if assignee_ids:
        allowed = ProjectMember.objects.filter(
            project_id=project.id, member_id__in=assignee_ids, is_active=True
        ).values_list("member_id", flat=True)
        IssueAssignee.objects.bulk_create(
            [
                IssueAssignee(
                    issue=work_item,
                    assignee_id=member_id,
                    project_id=project.id,
                    workspace_id=project.workspace_id,
                    created_by_id=run.actor_id,
                )
                for member_id in allowed
            ],
            batch_size=100,
            ignore_conflicts=True,
        )

    label_ids = _uuid_list(config.get("label_ids"))
    if label_ids:
        allowed = Label.objects.filter(pk__in=label_ids, project_id=project.id).values_list("id", flat=True)
        IssueLabel.objects.bulk_create(
            [
                IssueLabel(
                    issue=work_item,
                    label_id=label_id,
                    project_id=project.id,
                    workspace_id=project.workspace_id,
                    created_by_id=run.actor_id,
                )
                for label_id in allowed
            ],
            batch_size=100,
            ignore_conflicts=True,
        )

    from plane.bgtasks.issue_activities_task import issue_activity

    issue_activity.delay(
        type="issue.activity.created",
        requested_data=json.dumps({"name": name, "id": str(work_item.id)}, cls=DjangoJSONEncoder),
        actor_id=str(run.actor_id) if run.actor_id else None,
        issue_id=str(work_item.id),
        project_id=str(project.id),
        current_instance=None,
        epoch=int(timezone.now().timestamp()),
        notification=True,
        automation_context={
            "depth": run.depth + 1,
            "automation_ids": [*run.ancestor_automation_ids, str(run.automation.id)],
        },
    )
    return _step(
        action,
        "success",
        f"Created {project.identifier}-{work_item.sequence_id}.",
    )


# ---------------------------------------------------------------------------
# archive_work_item
# ---------------------------------------------------------------------------


def handle_archive_work_item(action, context, run):
    work_item = context.work_item
    if work_item is None:
        raise ActionError("This action needs a work item to archive.")
    if work_item.archived_at is not None:
        return _step(action, "skipped", "Already archived.")

    archived_at = context.today
    work_item.archived_at = archived_at
    work_item.save(update_fields=["archived_at", "updated_at"])

    _log_issue_activity(
        context,
        run,
        {"archived_at": str(archived_at), "automation": True},
        {"archived_at": None},
    )
    context.invalidate("is_archived")
    return _step(action, "success", "Work item archived.")


# ---------------------------------------------------------------------------
# call_webhook
# ---------------------------------------------------------------------------


def handle_call_webhook(action, context, run):
    config = action.config or {}
    url = (config.get("url") or "").strip()
    if not url:
        raise ActionError("No webhook URL configured.")

    method = (config.get("method") or "POST").upper()
    if method not in ("POST", "PUT", "PATCH"):
        raise ActionError(f"'{method}' is not a supported webhook method.")

    headers = {"Content-Type": "application/json"}
    for key, value in (config.get("headers") or {}).items():
        headers[str(key)] = render(str(value), context)

    if config.get("payload"):
        body = render(str(config["payload"]), context)
    else:
        body = json.dumps(
            {
                "automation": {"id": str(run.automation.id), "name": run.automation.name},
                "trigger": context.trigger_type,
                "work_item": (
                    {
                        "id": str(context.work_item.id),
                        "identifier": f"{context.project.identifier}-{context.work_item.sequence_id}",
                        "name": context.work_item.name,
                    }
                    if context.work_item is not None
                    else None
                ),
                "project": {"id": str(context.project.id), "name": context.project.name} if context.project else None,
            },
            cls=DjangoJSONEncoder,
        )

    try:
        response = pinned_fetch(
            method,
            url,
            headers=headers,
            data=body.encode("utf-8"),
            timeout=WEBHOOK_TIMEOUT_SECONDS,
        )
    except ValueError as exception:
        # SSRF guard rejected the target.
        raise ActionError(str(exception)) from exception
    except requests.RequestException as exception:
        raise ActionError(f"The webhook request failed: {exception}") from exception

    if response.status_code >= 400:
        raise ActionError(f"The webhook responded with {response.status_code}.")
    return _step(action, "success", f"Webhook responded with {response.status_code}.")


HANDLERS = {
    ActionType.CHANGE_PROPERTY: handle_change_property,
    ActionType.ADD_COMMENT: handle_add_comment,
    ActionType.SEND_NOTIFICATION: handle_send_notification,
    ActionType.CREATE_WORK_ITEM: handle_create_work_item,
    ActionType.ARCHIVE_WORK_ITEM: handle_archive_work_item,
    ActionType.CALL_WEBHOOK: handle_call_webhook,
}


def get_handler(action_type: str):
    return HANDLERS.get(action_type)
