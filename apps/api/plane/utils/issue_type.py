# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared helpers for work item types (``IssueType`` / ``ProjectIssueType``).

Every work item has a type that is linked to its project, and every project
has at least one linked type.
"""

# Module imports
from plane.db.models import IssueType, ProjectIssueType
from plane.utils.uuid import is_valid_uuid

STARTER_TYPE_NAME = "Task"


def link_starter_type(project):
    """Link the workspace's "Task" type to `project`, creating the type if needed.

    New projects start with this type so they always have one to create work
    items with. Returns the type.
    """
    issue_type = (
        IssueType.objects.filter(workspace_id=project.workspace_id, name=STARTER_TYPE_NAME, is_epic=False)
        .order_by("created_at")
        .first()
    )
    if issue_type is None:
        issue_type = IssueType.objects.create(
            workspace_id=project.workspace_id,
            name=STARTER_TYPE_NAME,
            description="",
            logo_props={},
            is_epic=False,
            is_active=True,
        )
    ProjectIssueType.objects.get_or_create(
        project_id=project.id,
        issue_type_id=issue_type.id,
        defaults={"workspace_id": project.workspace_id},
    )
    return issue_type


def linked_types(project_id):
    """The types linked to `project_id`, in the order the UI lists them."""
    return IssueType.objects.filter(
        project_issue_types__project_id=project_id,
        project_issue_types__deleted_at__isnull=True,
    ).order_by("level", "name")


def is_type_linked(issue_type_id, project_id):
    return linked_types(project_id).filter(pk=issue_type_id).exists()


def project_has_active_type(project_id):
    """Whether `project_id` has at least one active, enabled work item type."""
    return ProjectIssueType.objects.filter(
        project_id=project_id,
        deleted_at__isnull=True,
        issue_type__is_active=True,
    ).exists()


def work_item_type_error(project_id, issue_type_id):
    """Why a work item in `project_id` cannot get `issue_type_id`, or None."""
    if not issue_type_id:
        return "Choose the type of the work item."
    if not is_valid_uuid(str(issue_type_id)) or not is_type_linked(issue_type_id, project_id):
        return "This work item type is not enabled for the project."
    return None
