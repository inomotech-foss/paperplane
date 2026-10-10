# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared helpers for work item types (``IssueType`` / ``ProjectIssueType``).

Used by both the public v1 API (``plane.api``) and the internal app API
(``plane.app``), the project-creation flow, and the ``0125`` data migration
(which duplicates the same small amount of logic against historical models
instead of importing this module — see that migration's docstring) so all
of them provision the same "default work item type" shape.

A work item without a type has its project's default type: the workspace's
`IssueType.is_default` type, when a live `ProjectIssueType` links it to the
project. `ProjectIssueType.is_default` can drift and is ignored. Filters,
counts and groupings go through the helpers below so they all read a missing
type the same way.
"""

# Django imports
from django.db.models import OuterRef, Q, Subquery, UUIDField
from django.db.models.expressions import RawSQL
from django.db.models.functions import Coalesce

# Module imports
from plane.db.models import IssueType, ProjectIssueType

# Projects with a default work item type, and those whose default is one of
# the given types.
DEFAULT_TYPE_PROJECTS_SQL = (
    "SELECT pit.project_id FROM project_issue_types pit"
    " JOIN issue_types it ON it.id = pit.issue_type_id"
    " WHERE it.is_default AND it.deleted_at IS NULL AND pit.deleted_at IS NULL"
)
DEFAULT_TYPE_IN_SQL = DEFAULT_TYPE_PROJECTS_SQL + " AND pit.issue_type_id = ANY(%s::uuid[])"


def default_type_projects_q(type_ids=None):
    """Work items in a project with a default type, or with one of `type_ids` as default."""
    if type_ids is None:
        return Q(project_id__in=RawSQL(DEFAULT_TYPE_PROJECTS_SQL, ()))
    return Q(project_id__in=RawSQL(DEFAULT_TYPE_IN_SQL, ([str(type_id) for type_id in type_ids],)))


def type_in_q(type_ids):
    """Work items whose type, or project default when untyped, is one of `type_ids`."""
    type_ids = list(type_ids)
    return Q(type_id__in=type_ids) | (Q(type_id__isnull=True) & default_type_projects_q(type_ids))


def _default_type_links():
    return ProjectIssueType.objects.filter(issue_type__is_default=True, issue_type__deleted_at__isnull=True)


def effective_type_id():
    """An annotation with the work item's type, or its project's default type when it has none."""
    default = _default_type_links().filter(project_id=OuterRef("project_id")).order_by().values("issue_type_id")[:1]
    return Coalesce("type_id", Subquery(default), output_field=UUIDField())


def project_default_type_id(project_id):
    """The id of `project_id`'s default work item type, or None."""
    return _default_type_links().filter(project_id=project_id).values_list("issue_type_id", flat=True).first()


def get_or_create_default_issue_type(project):
    """Ensure `project` has a default (non-epic) work item type enabled.

    `IssueType` is workspace-scoped: if the workspace already has a default
    type (``is_default=True``), it is reused and simply linked to `project`
    via `ProjectIssueType`. Otherwise a new "Task" type is created for the
    workspace. Never touches `Issue` rows.

    Returns the (possibly newly created) default `IssueType`.
    """
    issue_type = IssueType.objects.filter(workspace_id=project.workspace_id, is_default=True).first()
    if issue_type is None:
        issue_type = IssueType.objects.create(
            workspace_id=project.workspace_id,
            name="Task",
            description="",
            logo_props={},
            is_epic=False,
            is_default=True,
            is_active=True,
        )

    ProjectIssueType.objects.get_or_create(
        project_id=project.id,
        issue_type_id=issue_type.id,
        defaults={
            "workspace_id": project.workspace_id,
            "is_default": True,
        },
    )
    return issue_type


def project_has_active_type(project_id):
    """Whether `project_id` has at least one active, enabled work item type."""
    return ProjectIssueType.objects.filter(
        project_id=project_id,
        deleted_at__isnull=True,
        issue_type__is_active=True,
    ).exists()
