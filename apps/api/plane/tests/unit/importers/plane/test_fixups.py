# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.db import connection

from plane.db.models import Issue, IssueType, Project, ProjectIssueType, User, Workspace
from plane.importers.plane.fixups import assign_default_types, link_untyped_projects, material_type_icons

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

    source = FakeSource(
        {"issue_types": [{"id": default.id, "is_default": True}, {"id": placeholder.id, "is_default": False}]}
    )
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


@pytest.mark.django_db
def test_project_without_any_type_gets_task():
    project = make_project("typeless")
    with connection.cursor() as cursor:
        assert link_untyped_projects(cursor) == 1
    linked = ProjectIssueType.objects.get(project=project)
    assert linked.issue_type.name == "Task"


def icon_of(workspace, name, logo_props):
    issue_type = IssueType.objects.create(workspace=workspace, name=name, logo_props=logo_props)
    return issue_type


@pytest.mark.django_db
def test_plane_type_icons_become_material_icons():
    workspace = make_project("icons").workspace
    epic = icon_of(workspace, "Epic", {"in_use": "icon", "icon": {"name": "Epic", "background_color": "#999AA0"}})
    code = icon_of(workspace, "Build", {"in_use": "icon", "icon": {"name": "Code", "background_color": "#4C49F8"}})
    task = icon_of(workspace, "Task", {"in_use": "icon", "icon": {"color": "#ffffff", "background_color": "#6695FF"}})
    bare = icon_of(workspace, "Task", {})
    bare_epic = icon_of(workspace, "Epic", {})
    emoji = icon_of(workspace, "Bug", {"in_use": "emoji", "emoji": {"value": "128027"}})

    with connection.cursor() as cursor:
        assert material_type_icons(cursor) == 5

    def logo(issue_type):
        issue_type.refresh_from_db()
        return issue_type.logo_props

    assert logo(epic) == {"in_use": "icon", "icon": {"name": "stacks", "color": "#999AA0"}}
    assert logo(code) == {"in_use": "icon", "icon": {"name": "code", "color": "#4C49F8"}}
    assert logo(task) == {"in_use": "icon", "icon": {"name": "task_alt", "color": "#6695FF"}}
    assert logo(bare) == {"in_use": "icon", "icon": {"name": "task_alt", "color": "#6b7280"}}
    assert logo(bare_epic) == {"in_use": "icon", "icon": {"name": "stacks", "color": "#6b7280"}}
    assert logo(emoji) == {"in_use": "emoji", "emoji": {"value": "128027"}}
