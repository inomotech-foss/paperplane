# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Provision one default "Task" IssueType per workspace and link it to every
project that does not yet have an active, non-epic type enabled.

This only touches `IssueType` / `ProjectIssueType` rows. It never creates,
updates, or backfills `Issue` rows: `Issue.type` stays NULL for every
pre-existing work item and continues to mean "the project's default type",
resolved lazily by callers.

Uses the historical (frozen) model API via `apps.get_model` rather than
importing `plane.utils.issue_type.get_or_create_default_issue_type` — the
historical models don't have the same manager/method surface as the real
app models, and importing application code into a data migration is an
anti-pattern that breaks the moment the app code changes shape. The same
small amount of logic is intentionally duplicated in
`plane.utils.issue_type` for use by the view/serializer layer.
"""

from django.db import migrations


def create_default_issue_types(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    IssueType = apps.get_model("db", "IssueType")
    ProjectIssueType = apps.get_model("db", "ProjectIssueType")

    # Cache of workspace_id -> default IssueType id, so we only ever look up
    # (or create) one default type per workspace, no matter how many
    # projects it has.
    default_type_by_workspace = {}

    projects = Project.objects.all().order_by("workspace_id", "id").only("id", "workspace_id")

    for project in projects.iterator():
        workspace_id = project.workspace_id

        issue_type_id = default_type_by_workspace.get(workspace_id)
        if issue_type_id is None:
            issue_type = IssueType.objects.filter(workspace_id=workspace_id, is_default=True).first()
            if issue_type is None:
                issue_type = IssueType.objects.create(
                    workspace_id=workspace_id,
                    name="Task",
                    description="",
                    logo_props={},
                    is_epic=False,
                    is_default=True,
                    is_active=True,
                )
            issue_type_id = issue_type.id
            default_type_by_workspace[workspace_id] = issue_type_id

        ProjectIssueType.objects.get_or_create(
            project_id=project.id,
            issue_type_id=issue_type_id,
            defaults={
                "workspace_id": workspace_id,
                "is_default": True,
            },
        )


def noop_reverse(apps, schema_editor):
    # Intentionally a no-op: reversing this migration would need to decide
    # whether to delete IssueType/ProjectIssueType rows that may since have
    # been edited or relied upon by users; leaving the provisioned default
    # types in place on rollback is the safe behavior.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0124_issue_property_issue_type"),
    ]

    operations = [
        migrations.RunPython(create_default_issue_types, noop_reverse),
    ]
