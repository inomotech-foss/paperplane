# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from datetime import datetime, timezone

import pytest

from plane.db.models import (
    Issue,
    IssueComment,
    IssueLink,
    IssueType,
    Label,
    Project,
    ProjectIdentifier,
    ProjectIssueType,
    User,
    Workspace,
)
from plane.importers.plane.loader import ImportConflict, ImportRefused, PlaneImporter

from .fakes import FakeSource

THEN = datetime(2024, 5, 1, 9, 30, tzinfo=timezone.utc)


def ident():
    return uuid.uuid4()


def row(**values):
    return {"id": ident(), "created_at": THEN, "updated_at": THEN, **values}


def plane(slug="acme", key="ABC"):
    """A small Plane workspace: two users, a project, three work items and the things around them."""
    ada, bob = row(email="ada@example.test", username="ada"), row(email="bob@example.test", username="bob")
    workspace = row(name=slug, slug=slug, owner_id=ada["id"])
    ws = {"workspace_id": workspace["id"]}
    project = row(name="Project", identifier=key, **ws)
    pj = {"project_id": project["id"], **ws}
    todo = row(name="Todo", group="unstarted", **pj)
    epic = row(name="Epic", is_default=False, **ws)
    task = row(name="Task", is_default=True, **ws)
    parent = row(name="Parent", sequence_id=1, state_id=todo["id"], type_id=epic["id"], created_by_id=bob["id"], **pj)
    child = row(name="Child", sequence_id=2, parent_id=parent["id"], type_id=None, **pj)
    loose = row(name="Loose", sequence_id=7, type_id=None, **pj)
    issues = [child, parent, loose]
    page = row(name="Runbook", owned_by_id=ada["id"], **ws)
    tables = {
        "users": [ada, bob],
        "workspaces": [workspace],
        "workspace_members": [row(member_id=ada["id"], role=20, **ws), row(member_id=bob["id"], role=15, **ws)],
        "projects": [project],
        "project_members": [row(member_id=ada["id"], role=20, **pj)],
        "states": [todo],
        "issue_types": [epic, task],
        "project_issue_types": [row(issue_type_id=epic["id"], **pj), row(issue_type_id=task["id"], **pj)],
        "issues": issues,
        "issue_sequences": [row(issue_id=i["id"], sequence=i["sequence_id"], **pj) for i in issues],
        "issue_comments": [row(issue_id=parent["id"], comment_html="<p>hi</p>", actor_id=bob["id"], **pj)],
        "issue_reactions": [row(issue_id=parent["id"], actor_id=bob["id"], reaction="+1", **pj)],
        "issue_activities": [row(issue_id=parent["id"], actor_id=bob["id"], verb="created", **pj)],
        "pages": [page],
        "workitem_pages": [row(issue_id=parent["id"], page_id=page["id"], **pj)],
        "sessions": [{"session_key": "x"}],
        "brand_new": [{"id": ident()}],
    }
    return tables, {"workspace": workspace, "project": project, "parent": parent, "child": child, "loose": loose}


def run(tables, **options):
    return PlaneImporter(FakeSource(tables), web_url="http://pp.test", **options).run()


@pytest.mark.django_db
def test_imports_and_reports():
    tables, rows = plane()
    report = run(tables)
    assert report.written["issues"] == 3
    assert report.written["issue_reactions"] == 1
    assert report.unknown == {"brand_new": 1}
    assert report.skipped["sessions"][0] == 1
    assert report.page_links == 1
    link = IssueLink.objects.get(issue_id=rows["parent"]["id"])
    assert link.url.endswith(f"/acme/projects/{rows['project']['id']}/pages/{tables['pages'][0]['id']}/")
    assert Workspace.objects.get(slug="acme").pql_dialect == "plane"


@pytest.mark.django_db
def test_keys_survive():
    tables, rows = plane()
    run(tables)
    project = Project.objects.get(pk=rows["project"]["id"])
    assert project.identifier == "ABC"
    assert ProjectIdentifier.objects.get(project=project).name == "ABC"
    assert Issue.all_objects.get(pk=rows["loose"]["id"]).sequence_id == 7
    parent = Issue.all_objects.get(pk=rows["parent"]["id"])
    assert (parent.created_at, parent.created_by.email) == (THEN, "bob@example.test")
    assert Issue.all_objects.get(pk=rows["child"]["id"]).parent_id == parent.id


@pytest.mark.django_db
def test_untyped_items_get_project_default():
    tables, rows = plane()
    report = run(tables)
    task = tables["issue_types"][1]["id"]
    assert Issue.all_objects.get(pk=rows["child"]["id"]).type_id == task
    assert Issue.all_objects.get(pk=rows["parent"]["id"]).type_id == tables["issue_types"][0]["id"]
    assert report.typed == 2


@pytest.mark.django_db
def test_project_without_types_gets_task():
    tables, rows = plane()
    tables["issue_types"], tables["project_issue_types"] = [], []
    for issue in tables["issues"]:
        issue["type_id"] = None
    report = run(tables)
    linked = ProjectIssueType.objects.get(project_id=rows["project"]["id"]).issue_type
    assert linked.name == "Task"
    assert Issue.all_objects.get(pk=rows["parent"]["id"]).type_id == linked.id
    assert report.typed_projects == 1


@pytest.mark.django_db
def test_matched_user_keeps_their_account(create_user):
    tables, rows = plane()
    tables["users"][1]["email"] = create_user.email.upper()
    report = run(tables)
    assert report.matched_users == 1
    assert Issue.all_objects.get(pk=rows["parent"]["id"]).created_by_id == create_user.id
    assert IssueComment.all_objects.get().actor_id == create_user.id
    assert not User.objects.filter(pk=tables["users"][1]["id"]).exists()


@pytest.mark.django_db
def test_refuses_existing_slug(create_user):
    Workspace.objects.create(name="acme", slug="acme", owner=create_user)
    with pytest.raises(ImportRefused):
        run(plane()[0])


@pytest.mark.django_db
def test_refuses_slug_with_other_id_even_when_allowed(create_user):
    Workspace.objects.create(name="acme", slug="acme", owner=create_user)
    with pytest.raises(ImportRefused, match="different"):
        run(plane()[0], allow_existing=True)


@pytest.mark.django_db
def test_refuses_unknown_workspace_filter():
    with pytest.raises(ImportRefused, match="nope"):
        run(plane()[0], workspaces=["nope"])


@pytest.mark.django_db
def test_rerun_is_idempotent():
    tables, rows = plane()
    run(tables)
    counts = (
        Issue.all_objects.count(),
        IssueLink.all_objects.count(),
        IssueType.all_objects.count(),
        User.objects.count(),
    )
    report = run(tables, allow_existing=True)
    assert counts == (
        Issue.all_objects.count(),
        IssueLink.all_objects.count(),
        IssueType.all_objects.count(),
        User.objects.count(),
    )
    assert report.written["issues"] == 3
    assert Issue.all_objects.get(pk=rows["parent"]["id"]).updated_at == THEN


@pytest.mark.django_db
def test_workspace_filter():
    first, _ = plane("acme", "ABC")
    second, _ = plane("other", "OTH")
    tables = {name: first.get(name, []) + second.get(name, []) for name in first.keys() | second.keys()}
    report = run(tables, workspaces=["acme"])
    assert list(Workspace.objects.values_list("slug", flat=True)) == ["acme"]
    assert Issue.all_objects.count() == 3
    assert report.dropped["issues"]["outside selection"] == 3
    assert User.objects.filter(email="bob@example.test").count() == 1


@pytest.mark.django_db
def test_dry_run_rolls_back():
    tables, _ = plane()
    report = PlaneImporter(FakeSource(tables), web_url="http://pp.test").run(dry_run=True)
    assert report.written["issues"] == 3
    assert not Workspace.objects.filter(slug="acme").exists()


@pytest.mark.django_db
def test_natural_key_clash_raises_import_conflict():
    tables, rows = plane()
    run(tables)
    label = {"name": "bug", "project_id": rows["project"]["id"], "workspace_id": rows["workspace"]["id"]}
    Label.objects.create(**label)
    tables["labels"] = [row(**label)]
    with pytest.raises(ImportConflict, match="labels"):
        run(tables, allow_existing=True)
