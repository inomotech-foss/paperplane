# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared helpers for work item types (``IssueType`` / ``ProjectIssueType``).

Every work item has a type that is linked to its project, and every project
has at least one linked type.
"""

# Module imports
from plane.db.models import Intake, IssueType, ProjectIssueType
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


def enable_intake(project, issue_type):
    """Turn on the project's intake with `issue_type` as the type of its new work items."""
    intake = Intake.objects.filter(project=project).order_by("-is_default").first()
    if intake is None:
        return Intake.objects.create(
            name=f"{project.name} Intake", project=project, is_default=True, issue_type=issue_type
        )
    if intake.issue_type_id != issue_type.id:
        intake.issue_type = issue_type
        intake.save(update_fields=["issue_type"])
    return intake


def intake_type_error(project, issue_type_id):
    """Why `issue_type_id` cannot be the intake type of `project`, or None."""
    if not issue_type_id:
        return "Choose the type of the work items that arrive through the intake."
    if not is_valid_uuid(issue_type_id) or not is_type_linked(issue_type_id, project.id):
        return "This work item type is not enabled for the project."
    return None


def intake_type_mismatch(intake, requested_type_id):
    """Why a work item sent to `intake` cannot have `requested_type_id`, or None when it is omitted or matches."""
    if requested_type_id and str(requested_type_id) != str(intake.issue_type_id):
        return f"Work items of this intake get the type {intake.issue_type.name}."
    return None


def intake_enable_error(project, issue_type_id):
    """Why intake cannot be turned on with `issue_type_id`, or None.

    An intake that existed before keeps its type, so only a project without one needs a type.
    """
    if not issue_type_id and Intake.objects.filter(project=project).exists():
        return None
    return intake_type_error(project, issue_type_id)


def turn_on_intake(project, issue_type_id):
    """Create or update the intake once `intake_enable_error` passed."""
    if issue_type_id:
        enable_intake(project, IssueType.objects.get(pk=issue_type_id))


def new_project_intake_type(workspace_id, issue_type_id):
    """The type a project created with intake on uses for it, or an error message."""
    if not issue_type_id:
        return "Choose the type of the work items that arrive through the intake."
    issue_type = None
    if is_valid_uuid(str(issue_type_id)):
        issue_type = IssueType.objects.filter(pk=issue_type_id, workspace_id=workspace_id, is_epic=False).first()
    if issue_type is None:
        return "The intake type must be a work item type of this workspace that is not an epic."
    return issue_type


def set_up_new_project_intake(project, issue_type):
    """Link `issue_type` to a new project and turn its intake on with it."""
    ProjectIssueType.objects.get_or_create(
        project_id=project.id, issue_type_id=issue_type.id, defaults={"workspace_id": project.workspace_id}
    )
    enable_intake(project, issue_type)
