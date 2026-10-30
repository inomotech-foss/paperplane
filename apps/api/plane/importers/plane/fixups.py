# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace

from plane.db.models import ProjectIssueType
from plane.utils.issue_type import link_starter_type


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
        cursor.execute(
            "UPDATE issues SET type_id = %s WHERE project_id = %s AND type_id IS NULL", [linked, project_id]
        )
        typed += cursor.rowcount
    return typed
