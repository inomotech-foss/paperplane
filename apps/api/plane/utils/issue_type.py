# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared helpers for work item types (``IssueType`` / ``ProjectIssueType``).

Every work item has a type that is linked to its project, and every project
has at least one linked type.
"""

# Module imports
from plane.db.models import Intake, Issue, IssueType, ProjectIssueType

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


def first_linked_type(project_id):
    """The first active type of `project_id` as the UI lists them, or None."""
    return linked_types(project_id).filter(is_active=True).first()


def project_has_active_type(project_id):
    """Whether `project_id` has at least one active, enabled work item type."""
    return ProjectIssueType.objects.filter(
        project_id=project_id,
        deleted_at__isnull=True,
        issue_type__is_active=True,
    ).exists()


def type_in_use_error(issue_type, project_id=None):
    """Why `issue_type` cannot be removed from `project_id`, or from the workspace when None.

    A type stays while work items or an intake of the project use it.
    """
    issues = Issue.objects.filter(type_id=issue_type.id)
    intakes = Intake.objects.filter(issue_type_id=issue_type.id)
    if project_id is not None:
        issues = issues.filter(project_id=project_id)
        intakes = intakes.filter(project_id=project_id)
    count = issues.count()
    if count:
        noun = "work item uses" if count == 1 else "work items use"
        return f"{count} {noun} the type {issue_type.name}. Change their type first."
    if intakes.exists():
        return f"The intake creates work items of the type {issue_type.name}. Choose another intake type first."
    return None


def get_or_create_intake(project):
    """The project's default intake. A new one creates work items of the project's first type."""
    intake = Intake.objects.filter(project=project, is_default=True).first()
    if intake is None:
        intake = Intake.objects.filter(project=project).first()
    if intake is None:
        issue_type = first_linked_type(project.id) or link_starter_type(project)
        intake = Intake.objects.create(
            name=f"{project.name} Intake", project=project, is_default=True, issue_type=issue_type
        )
    return intake
