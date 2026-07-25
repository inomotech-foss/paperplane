# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
``{{ variable }}`` substitution for comment bodies, notification text and
webhook payloads.

Deliberately not a real template language: only the flat keys advertised in
``registry.TEMPLATE_VARIABLES`` resolve, everything else is left untouched so a
typo shows up in the output instead of blowing up a run. Values are inserted as
plain text, and the caller decides whether the result lands in HTML (see
``render_html``).
"""

# Python imports
import html
import re

# Django imports
from django.conf import settings

VARIABLE_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")

PRIORITY_LABELS = {
    "urgent": "Urgent",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "none": "None",
}


def _join(names) -> str:
    names = [name for name in names if name]
    if not names:
        return ""
    return ", ".join(names)


def build_variables(context) -> dict[str, str]:
    """Flatten a context into the dotted keys the designer advertises."""
    work_item = context.work_item
    project = context.project
    workspace = getattr(project, "workspace", None)
    automation = context.automation

    variables: dict[str, str] = {
        "project.name": getattr(project, "name", "") or "",
        "project.identifier": getattr(project, "identifier", "") or "",
        "workspace.name": getattr(workspace, "name", "") or "",
        "automation.name": getattr(automation, "name", "") or "",
        "trigger.type": context.trigger_type or "",
        "now.date": context.today.isoformat(),
    }

    if work_item is not None:
        identifier = f"{getattr(project, 'identifier', '')}-{work_item.sequence_id}"
        web_url = (settings.WEB_URL or "").rstrip("/")
        workspace_slug = getattr(workspace, "slug", "")
        variables.update(
            {
                "work_item.name": work_item.name or "",
                "work_item.identifier": identifier,
                "work_item.url": (
                    f"{web_url}/{workspace_slug}/projects/{project.id}/issues/{work_item.id}"
                    if web_url and workspace_slug
                    else ""
                ),
                "work_item.state": getattr(work_item.state, "name", "") if work_item.state_id else "",
                "work_item.priority": PRIORITY_LABELS.get(work_item.priority, work_item.priority or ""),
                "work_item.assignees": _join(
                    work_item.assignees.values_list("display_name", flat=True),
                ),
                "work_item.labels": _join(work_item.labels.values_list("name", flat=True)),
                "work_item.target_date": work_item.target_date.isoformat() if work_item.target_date else "",
                "work_item.start_date": work_item.start_date.isoformat() if work_item.start_date else "",
                "work_item.created_by": getattr(work_item.created_by, "display_name", "") or "",
            }
        )

    return variables


def render(text: str, context) -> str:
    """Substitute variables into a plain-text template."""
    if not text:
        return ""
    variables = build_variables(context)

    def replace(match: re.Match) -> str:
        key = match.group(1)
        # Unknown keys stay verbatim so authors can see what didn't resolve.
        return variables.get(key, match.group(0))

    return VARIABLE_PATTERN.sub(replace, text)


def render_html(template: str, context) -> str:
    """
    Substitute variables into an HTML template, escaping the inserted values so
    a work item title containing `<` cannot break the markup.
    """
    if not template:
        return ""
    variables = build_variables(context)

    def replace(match: re.Match) -> str:
        key = match.group(1)
        if key not in variables:
            return match.group(0)
        return html.escape(variables[key])

    return VARIABLE_PATTERN.sub(replace, template)
