# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared helpers for work item types (``IssueType`` / ``ProjectIssueType``).

Used by both the public v1 API (``plane.api``) and the internal app API
(``plane.app``), the project-creation flow, and the ``0125`` data migration
(which duplicates the same small amount of logic against historical models
instead of importing this module — see that migration's docstring) so all
of them provision the same "default work item type" shape.
"""

# Module imports
from plane.db.models import IssueType, ProjectIssueType


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
