# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared helpers for work item types (``IssueType`` / ``ProjectIssueType``).

Every work item has a type that is linked to its project, and every project
has at least one linked type.
"""

# Django imports
from django.db import transaction

# Module imports
from plane.db.models import (
    AutomationAction,
    DraftIssue,
    Intake,
    Issue,
    IssueType,
    Project,
    ProjectIssueType,
)
from plane.utils.derived_properties import schedule_derived_refresh
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


CREATE_WORK_ITEM_ACTION = "create_work_item"


def _action_project_id(action):
    """The project a "create work item" action creates in, None when it follows the run."""
    project_id = action.config.get("project_id") or action.automation.project_id
    return str(project_id) if project_id else None


class TypeReferences:
    """Every row that points at `issue_type`, in `project_id` or in the whole workspace when None.

    Soft-deleted rows count too: they are kept until the nightly purge and must stay valid.
    """

    def __init__(self, issue_type, project_id=None):
        self.issue_type = issue_type
        self.project_id = str(project_id) if project_id else None
        scope = {"project_id": project_id} if project_id else {}
        self.issues = Issue.all_objects.filter(type_id=issue_type.id, **scope)
        self.drafts = DraftIssue.all_objects.filter(type_id=issue_type.id, **scope)
        self.intakes = Intake.all_objects.filter(issue_type_id=issue_type.id, **scope)
        actions = AutomationAction.all_objects.filter(
            workspace_id=issue_type.workspace_id,
            action_type=CREATE_WORK_ITEM_ACTION,
            config__type_id=str(issue_type.id),
        ).select_related("automation")
        self.actions = [
            action for action in actions if self.project_id is None or _action_project_id(action) == self.project_id
        ]

    def counts(self):
        return {
            "work_items": self.issues.filter(deleted_at__isnull=True).count(),
            "deleted_work_items": self.issues.filter(deleted_at__isnull=False).count(),
            "drafts": self.drafts.count(),
            "intakes": self.intakes.count(),
            "automation_actions": len(self.actions),
        }

    def exist(self):
        return bool(self.actions or self.issues.exists() or self.drafts.exists() or self.intakes.exists())

    def project_ids(self):
        ids = set(self.issues.values_list("project_id", flat=True).distinct())
        ids |= set(self.drafts.exclude(project_id__isnull=True).values_list("project_id", flat=True).distinct())
        ids |= set(self.intakes.values_list("project_id", flat=True).distinct())
        ids |= {action_project for action in self.actions if (action_project := _action_project_id(action))}
        return {str(project_id) for project_id in ids}

    def replacement_error(self, replacement):
        """Why `replacement` cannot take over these rows, or None."""
        if replacement is None:
            return f"Work items still use the type {self.issue_type.name}. Choose a type to move them to."
        if replacement.id == self.issue_type.id:
            return "Choose a different type to move the work items to."
        if replacement.workspace_id != self.issue_type.workspace_id or not replacement.is_active:
            return "The replacement type must be an active type of this workspace."
        if replacement.is_epic != self.issue_type.is_epic:
            return "Epics can only move to an epic type, and other work items only to a type that is not an epic."
        linked = set(ProjectIssueType.objects.filter(issue_type_id=replacement.id).values_list("project_id", flat=True))
        # Rows of deleted projects move too, but those projects cannot link types anymore.
        missing = Project.objects.filter(pk__in=self.project_ids()).exclude(pk__in=linked).order_by("identifier")
        if missing:
            names = ", ".join(f"{project.name} ({project.identifier})" for project in missing)
            return f"The type {replacement.name} is not enabled in these projects: {names}."
        return None

    def move_to(self, replacement):
        """Point every row at `replacement`. Run inside the transaction that removes the type."""
        project_ids = self.project_ids()
        self.issues.update(type_id=replacement.id)
        self.drafts.update(type_id=replacement.id)
        self.intakes.update(issue_type_id=replacement.id)
        for action in self.actions:
            action.config = {**action.config, "type_id": str(replacement.id)}
            action.save(update_fields=["config"])
        for project_id in project_ids:
            schedule_derived_refresh(project_id)


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


def remove_issue_type(issue_type, replacement_type_id=None, project_id=None):
    """Unlink `issue_type` from `project_id`, or delete it from the workspace when None.

    Rows that still use the type move to the replacement first, in the same transaction.
    The replacement is only needed, and only looked at, when such rows exist. Returns an
    error message, or None once the type is gone.
    """
    references = TypeReferences(issue_type, project_id)
    replacement = None
    if references.exist():
        if replacement_type_id:
            if not is_valid_uuid(str(replacement_type_id)):
                return "The replacement type is not a valid id."
            replacement = IssueType.objects.filter(pk=replacement_type_id).first()
            if replacement is None:
                return "The replacement type does not exist."
        error = references.replacement_error(replacement)
        if error:
            return error

    with transaction.atomic():
        if replacement is not None:
            references.move_to(replacement)
        links = ProjectIssueType.objects.filter(issue_type_id=issue_type.id)
        if project_id is not None:
            links = links.filter(project_id=project_id)
        links.delete()
        if project_id is None or not (
            ProjectIssueType.objects.filter(issue_type_id=issue_type.id).exists() or TypeReferences(issue_type).exist()
        ):
            issue_type.delete()
    return None


def intake_type_mismatch(intake, requested_type_id):
    """Why a work item sent to `intake` cannot have `requested_type_id`, or None when it is omitted or matches."""
    if requested_type_id and str(requested_type_id) != str(intake.issue_type_id):
        return f"Work items of this intake get the type {intake.issue_type.name}."
    return None
