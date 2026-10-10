# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The backfill of 0149 against the schema it runs on.

The suite builds its database without migrations, so the test puts the
pre-0150 schema back inside its own transaction and runs the migration SQL.
"""

import importlib

import pytest
from django.db import connection
from django.utils import timezone

from plane.db.models import (
    Automation,
    AutomationAction,
    Intake,
    Issue,
    IssueType,
    Project,
    ProjectIssueType,
    User,
    Workspace,
)

backfill = importlib.import_module("plane.db.migrations.0149_backfill_issue_type")

PRE_0150_SCHEMA = [
    "ALTER TABLE issues ALTER COLUMN type_id DROP NOT NULL",
    "ALTER TABLE intakes ALTER COLUMN issue_type_id DROP NOT NULL",
    "ALTER TABLE issue_types ADD COLUMN is_default boolean NOT NULL DEFAULT false",
    "ALTER TABLE project_issue_types ADD COLUMN is_default boolean NOT NULL DEFAULT false",
]


def execute(*statements):
    with connection.cursor() as cursor:
        for statement in statements:
            cursor.execute(statement)


def make_workspace(slug):
    owner = User.objects.create(username=slug, email=f"{slug}@example.com")
    return Workspace.objects.create(name=slug, slug=slug, owner=owner)


def make_project(workspace, identifier, types=()):
    project = Project.objects.create(name=identifier, identifier=identifier, workspace=workspace)
    for issue_type in types:
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return project


def make_issue(project, name, **fields):
    return Issue.objects.create(name=name, project=project, workspace_id=project.workspace_id, **fields)


def type_of(issue):
    return Issue.all_objects.values_list("type_id", flat=True).get(pk=issue.pk)


@pytest.mark.unit
@pytest.mark.django_db
def test_every_work_item_intake_and_create_action_gets_a_type():
    execute(*PRE_0150_SCHEMA)

    inomo = make_workspace("inomo")
    task = IssueType.objects.create(workspace=inomo, name="Task")
    execute(f"UPDATE issue_types SET is_default = true WHERE id = '{task.id}'")
    bug = IssueType.objects.create(workspace=inomo, name="Bug")
    linked = make_project(inomo, "LNK", [task, bug])
    unlinked = make_project(inomo, "UNL", [bug])
    empty = make_project(inomo, "EMP")
    untyped = make_issue(linked, "untyped", type=None)
    typed = make_issue(linked, "typed", type=bug)
    deleted = make_issue(linked, "deleted", type=None, deleted_at=timezone.now())
    archived = make_issue(linked, "archived", type=None, archived_at=timezone.now().date())
    elsewhere = make_issue(unlinked, "elsewhere", type=None)
    intake = Intake.objects.create(name="Intake", project=unlinked, workspace=inomo, issue_type=None)
    automation = Automation.objects.create(workspace=inomo, project=linked, name="Rule")
    create = AutomationAction.objects.create(
        workspace=inomo, automation=automation, action_type="create_work_item", config={"name": "x"}
    )
    create_typed = AutomationAction.objects.create(
        workspace=inomo,
        automation=automation,
        action_type="create_work_item",
        config={"name": "x", "type_id": str(bug.id)},
    )
    comment = AutomationAction.objects.create(
        workspace=inomo, automation=automation, action_type="add_comment", config={}
    )

    bare = make_workspace("bare")
    bare_project = make_project(bare, "BAR")
    bare_issue = make_issue(bare_project, "bare", type=None)

    named = make_workspace("named")
    named_task = IssueType.objects.create(workspace=named, name="Task")
    named_issue = make_issue(make_project(named, "NAM", [named_task]), "named", type=None)

    execute(*backfill.Migration.operations[0].sql)

    assert {type_of(issue) for issue in (untyped, deleted, archived, elsewhere)} == {task.id}
    assert type_of(typed) == bug.id
    for project in (unlinked, empty):
        assert ProjectIssueType.objects.filter(project=project, issue_type=task).exists()
    assert ProjectIssueType.objects.filter(project=linked, issue_type=task).count() == 1
    assert Intake.objects.get(pk=intake.pk).issue_type_id == task.id

    def config_of(action):
        return AutomationAction.objects.get(pk=action.pk).config

    assert config_of(create) == {"name": "x", "type_id": str(task.id)}
    assert config_of(create_typed)["type_id"] == str(bug.id)
    assert config_of(comment) == {}

    created = IssueType.objects.get(workspace=bare)
    assert (created.name, created.is_epic) == ("Task", False)
    assert type_of(bare_issue) == created.id
    assert ProjectIssueType.objects.filter(project=bare_project, issue_type=created).exists()

    assert type_of(named_issue) == named_task.id
    assert IssueType.objects.filter(workspace=named).count() == 1

    execute(
        "SET CONSTRAINTS ALL IMMEDIATE",
        "ALTER TABLE issues ALTER COLUMN type_id SET NOT NULL",
        "ALTER TABLE intakes ALTER COLUMN issue_type_id SET NOT NULL",
    )
