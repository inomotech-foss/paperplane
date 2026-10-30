# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.db import connection

from plane.db.models import Issue, IssueType, Project, ProjectIssueType, User, Workspace
from plane.importers.plane.fixups import assign_default_types

from .fakes import FakeSource


def make_project(slug):
    owner = User.objects.create(username=slug, email=f"{slug}@example.com")
    workspace = Workspace.objects.create(name=slug, slug=slug, owner=owner)
    return Project.objects.create(name=slug, identifier=slug[:5].upper(), workspace=workspace)


def untyped_issue(project, placeholder):
    """A work item as copied from a Plane source whose type was null."""
    issue = Issue.objects.create(name="item", project=project, workspace_id=project.workspace_id, type=placeholder)
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
        cursor.execute("ALTER TABLE issues ALTER COLUMN type_id DROP NOT NULL")
        cursor.execute("UPDATE issues SET type_id = NULL WHERE id = %s", [issue.id])
    return issue


def type_of(issue):
    return Issue.all_objects.values_list("type_id", flat=True).get(pk=issue.pk)


def run(source):
    with connection.cursor() as cursor:
        return assign_default_types(source, cursor)


@pytest.mark.django_db
def test_null_type_gets_projects_default_type():
    project = make_project("defaults")
    placeholder = IssueType.objects.create(workspace_id=project.workspace_id, name="Placeholder")
    default = IssueType.objects.create(workspace_id=project.workspace_id, name="Story")
    ProjectIssueType.objects.create(project=project, issue_type=default, workspace_id=project.workspace_id)
    issue = untyped_issue(project, placeholder)

    source = FakeSource({"issue_types": [{"id": default.id, "is_default": True}, {"id": placeholder.id, "is_default": False}]})
    assert run(source) == 1
    assert type_of(issue) == default.id


@pytest.mark.django_db
def test_project_without_default_links_workspace_task():
    project = make_project("tasklink")
    task = IssueType.objects.create(workspace_id=project.workspace_id, name="Task")
    issue = untyped_issue(project, task)

    assert run(FakeSource({"issue_types": [{"id": task.id, "is_default": False}]})) == 1
    assert type_of(issue) == task.id
    assert ProjectIssueType.objects.filter(project=project, issue_type=task).exists()


@pytest.mark.django_db
def test_workspace_without_task_creates_one():
    project = make_project("notask")
    placeholder = IssueType.objects.create(workspace_id=project.workspace_id, name="Placeholder")
    issue = untyped_issue(project, placeholder)

    assert run(FakeSource()) == 1
    created = IssueType.objects.get(id=type_of(issue))
    assert created.name == "Task"
    assert ProjectIssueType.objects.filter(project=project, issue_type=created).exists()
