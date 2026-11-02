# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import re
from types import SimpleNamespace

from plane.db.models import ProjectIssueType
from plane.utils.issue_type import link_starter_type


def link_untyped_projects(cursor):
    """Link the workspace's "Task" type to every project that has no active type.

    A project without one cannot create work items.
    """
    cursor.execute(
        "SELECT p.id, p.workspace_id FROM projects p WHERE NOT EXISTS ("
        "SELECT 1 FROM project_issue_types pit JOIN issue_types t ON t.id = pit.issue_type_id "
        "WHERE pit.project_id = p.id AND pit.deleted_at IS NULL AND t.deleted_at IS NULL AND t.is_active)"
    )
    projects = cursor.fetchall()
    for project_id, workspace_id in projects:
        link_starter_type(SimpleNamespace(id=project_id, workspace_id=workspace_id))
    return len(projects)


# Plane Commercial names type icons in its own set; PaperPlane draws Material Symbols by name.
_MATERIAL_NAMES = {"epic": "stacks", "file": "description"}
_DEFAULT_ICON = "task_alt"
_DEFAULT_COLOR = "#6b7280"


def _material_icon(logo_props):
    icon = logo_props.get("icon") or {}
    name = (icon.get("name") or "").strip()
    name = _MATERIAL_NAMES.get(name.lower(), re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")) or _DEFAULT_ICON
    color = icon.get("color")
    if not color or color.lower() in ("#fff", "#ffffff"):
        color = icon.get("background_color") or _DEFAULT_COLOR
    return {"in_use": "icon", "icon": {"name": name, "color": color}}


def material_type_icons(cursor):
    """Rewrite every non-emoji type icon as a Material Symbols icon; returns how many changed."""
    cursor.execute("SELECT id, logo_props FROM issue_types")
    changed = 0
    for type_id, logo_props in cursor.fetchall():
        # Django's raw cursor hands jsonb back as text.
        logo_props = json.loads(logo_props) if isinstance(logo_props, str) else logo_props or {}
        if logo_props.get("in_use") == "emoji":
            continue
        new = _material_icon(logo_props)
        if new != logo_props:
            cursor.execute("UPDATE issue_types SET logo_props = %s WHERE id = %s", [json.dumps(new), type_id])
            changed += 1
    return changed


def _source_default_types(source):
    if "is_default" not in source.columns("issue_types"):
        return set()
    rows = source.rows("issue_types", ['id AS "id"', 'is_default AS "is_default"'])
    return {type_id for type_id, is_default in rows if is_default}


def assign_default_types(source, cursor):
    """Give every work item copied without a type its project's default type.

    The project's default is a linked type the source marked ``is_default``;
    failing that, the workspace's "Task" type, linked (and created) as needed.
    """
    defaults = _source_default_types(source)
    cursor.execute("SELECT DISTINCT project_id, workspace_id FROM issues WHERE type_id IS NULL")
    typed = 0
    for project_id, workspace_id in cursor.fetchall():
        linked = (
            ProjectIssueType.objects.filter(project_id=project_id, issue_type_id__in=defaults)
            .order_by("created_at")
            .values_list("issue_type_id", flat=True)
            .first()
        )
        if linked is None:
            linked = link_starter_type(SimpleNamespace(id=project_id, workspace_id=workspace_id)).id
        cursor.execute("UPDATE issues SET type_id = %s WHERE project_id = %s AND type_id IS NULL", [linked, project_id])
        typed += cursor.rowcount
    return typed


_PAGE_LINK_SELECT = [
    'id AS "id"',
    'issue_id AS "issue_id"',
    'project_id AS "project_id"',
    'workspace_id AS "workspace_id"',
    'page_id AS "page_id"',
    'created_at AS "created_at"',
    'updated_at AS "updated_at"',
    'created_by_id AS "created_by_id"',
    'deleted_at AS "deleted_at"',
    '(SELECT p.name FROM pages p WHERE p.id = page_id) AS "title"',
    '(SELECT w.slug FROM workspaces w WHERE w.id = workspace_id) AS "workspace_slug"',
]


def link_work_item_pages(source, cursor, web_url):
    """Turn Plane's work-item-to-page links into ordinary work item links.

    PaperPlane has no such link table. Each link keeps its id, dates and
    author; soft-deleted links stay deleted.
    """
    if not source.columns("workitem_pages"):
        return 0
    base = web_url.rstrip("/")
    linked = 0
    for row in source.rows("workitem_pages", _PAGE_LINK_SELECT):
        (
            link_id,
            issue_id,
            project_id,
            workspace_id,
            page_id,
            created_at,
            updated_at,
            created_by_id,
            deleted_at,
            title,
            slug,
        ) = row
        cursor.execute(
            "INSERT INTO issue_links (id, issue_id, project_id, workspace_id, title, url, metadata, created_at, "
            "updated_at, created_by_id, updated_by_id, deleted_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, '{}'::jsonb, %s, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, "
            "deleted_at = EXCLUDED.deleted_at, updated_at = EXCLUDED.updated_at",
            [
                link_id,
                issue_id,
                project_id,
                workspace_id,
                title or "Page",
                f"{base}/{slug}/projects/{project_id}/pages/{page_id}/",
                created_at,
                updated_at,
                created_by_id,
                created_by_id,
                deleted_at,
            ],
        )
        linked += 1
    return linked
