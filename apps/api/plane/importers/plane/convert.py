# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Values PaperPlane stores differently from Plane.

Each converter takes the source row and the import context and returns the
value for one field.
"""

import re

from plane.db.models.issue import IssueRelationChoices

# Plane Commercial names type icons in its own set; PaperPlane draws Material Symbols by name.
_MATERIAL_NAMES = {"epic": "stacks", "file": "description"}
_DEFAULT_ICON = "task_alt"
_DEFAULT_COLOR = "#6b7280"

_RELATION_TYPES = set(IssueRelationChoices.values)


def constant(value):
    return lambda row, ctx: value


def archived_date(row, ctx):
    """Plane keeps when an item was archived; PaperPlane keeps the day."""
    value = row.get("archived_at")
    return value.date() if hasattr(value, "date") else value


def material_icon(row, ctx):
    """A Plane type icon as a Material Symbols icon; emoji icons stay as they are."""
    logo_props = row.get("logo_props") or {}
    if logo_props.get("in_use") == "emoji":
        return logo_props

    icon = logo_props.get("icon") or {}
    name = (icon.get("name") or "").strip().lower()
    if name:
        name = _MATERIAL_NAMES.get(name, re.sub(r"[^a-z0-9]+", "_", name).strip("_"))
    else:
        name = _MATERIAL_NAMES.get((row.get("name") or "").strip().lower(), _DEFAULT_ICON)
    color = icon.get("color")
    if not color or color.lower() in ("#fff", "#ffffff"):
        color = icon.get("background_color") or _DEFAULT_COLOR

    converted = {"in_use": "icon", "icon": {"name": name or _DEFAULT_ICON, "color": color}}
    if converted != logo_props:
        ctx.note("type_icons", row)
    return converted


def relation_type(row, ctx):
    """The relation's own type, else the name of its Commercial definition.

    A type PaperPlane has no name for becomes ``relates_to`` and is counted, so
    the link survives even when its meaning narrows.
    """
    value = row.get("relation_type")
    if not value:
        name = ctx.state.get("relation_definitions", {}).get(row.get("definition_id")) or ""
        value = name.strip().lower().replace(" ", "_")
    if value in _RELATION_TYPES:
        return value
    ctx.note("relations_downgraded", row)
    return IssueRelationChoices.RELATES_TO.value


def page_links(source, ctx):
    """Plane's work-item-to-page links as ``issue_links`` rows.

    PaperPlane has no such link table, so each becomes an ordinary link to the
    page's URL, keeping its id, dates and author; a deleted link stays deleted.
    """
    titles = {row["id"]: row.get("name") for row in source.rows("pages")}
    slugs = {row["id"]: row.get("slug") for row in source.rows("workspaces")}
    base = ctx.web_url.rstrip("/")
    for row in source.rows("workitem_pages"):
        slug = slugs.get(row.get("workspace_id"))
        yield {
            "id": row["id"],
            "issue_id": row.get("issue_id"),
            "project_id": row.get("project_id"),
            "workspace_id": row.get("workspace_id"),
            "title": titles.get(row.get("page_id")) or "Page",
            "url": f"{base}/{slug}/projects/{row.get('project_id')}/pages/{row.get('page_id')}/",
            "metadata": {},
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "created_by_id": row.get("created_by_id"),
            "updated_by_id": row.get("created_by_id"),
            "deleted_at": row.get("deleted_at"),
        }
