# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from datetime import datetime, timezone

import pytest

from plane.db.models import Issue, IssueActivity, IssueComment, IssueType, Project, State, User, Workspace
from plane.importers.plane.entities import Context, Entity, load
from plane.importers.plane.ids import IdMap
from plane.importers.plane.report import ImportReport

from .fakes import FakeSource

THEN = datetime(2024, 5, 1, 9, 30, tzinfo=timezone.utc)
LATER = datetime(2024, 6, 2, 10, 0, tzinfo=timezone.utc)


def ident():
    return uuid.uuid4()


def stamped(**row):
    return {"id": ident(), "created_at": THEN, "updated_at": LATER, **row}


@pytest.fixture
def ctx():
    return Context(ids=IdMap(), report=ImportReport(), web_url="http://pp.test")


@pytest.fixture
def base(ctx):
    """A user, workspace, project, state and type, loaded through entities."""
    user = stamped(email="ada@example.test", username="ada", password="x")
    workspace = stamped(name="W", slug="w", owner_id=user["id"], created_by_id=user["id"])
    project = stamped(name="P", identifier="ABC", workspace_id=workspace["id"], created_by_id=user["id"])
    state = stamped(name="Todo", group="unstarted", project_id=project["id"], workspace_id=workspace["id"])
    issue_type = stamped(name="Task", workspace_id=workspace["id"])
    source = FakeSource(
        {
            "users": [user],
            "workspaces": [workspace],
            "projects": [project],
            "states": [state],
            "issue_types": [issue_type],
        }
    )
    for model in (User, Workspace, Project, State, IssueType):
        load(Entity(model), source, ctx)
    return {"user": user, "workspace": workspace, "project": project, "state": state, "type": issue_type}


def issue_row(base, **row):
    defaults = {
        "name": "Work item",
        "sequence_id": 1,
        "project_id": base["project"]["id"],
        "workspace_id": base["workspace"]["id"],
        "state_id": base["state"]["id"],
        "type_id": base["type"]["id"],
        "created_by_id": base["user"]["id"],
    }
    return stamped(**{**defaults, **row})


def load_issues(ctx, *rows):
    return load(Entity(Issue), FakeSource({"issues": list(rows)}), ctx)


@pytest.mark.django_db
def test_missing_column_takes_model_default(base):
    assert Workspace.objects.get(pk=base["workspace"]["id"]).timezone == "UTC"


@pytest.mark.django_db
def test_extra_column_is_ignored(ctx, base):
    assert load_issues(ctx, issue_row(base, brand_new_column="x")) == 1


@pytest.mark.django_db
def test_dates_and_author_are_kept(ctx, base):
    row = issue_row(base)
    load_issues(ctx, row)
    issue = Issue.all_objects.get(pk=row["id"])
    assert (issue.created_at, issue.updated_at, issue.created_by_id) == (THEN, LATER, base["user"]["id"])
    assert User.objects.get(pk=base["user"]["id"]).created_at == THEN


@pytest.mark.django_db
def test_nullable_orphan_fk_becomes_null(ctx, base):
    row = issue_row(base, state_id=ident())
    load_issues(ctx, row)
    assert Issue.all_objects.get(pk=row["id"]).state_id is None
    assert ctx.report.nulled["issues.state_id"] == 1


@pytest.mark.django_db
def test_required_orphan_fk_drops_row(ctx, base):
    comment = stamped(
        issue_id=ident(),
        project_id=base["project"]["id"],
        workspace_id=base["workspace"]["id"],
        comment_html="<p>hi</p>",
    )
    written = load(Entity(IssueComment), FakeSource({"issue_comments": [comment]}), ctx)
    assert written == 0
    assert not IssueComment.all_objects.filter(pk=comment["id"]).exists()
    assert ctx.report.dropped["issue_comments"]["missing parent"] == 1


@pytest.mark.django_db
def test_outside_selection_is_counted_apart(ctx, base):
    excluded = ident()
    ctx.ids.exclude(Workspace, excluded)
    load_issues(ctx, issue_row(base, workspace_id=excluded))
    assert ctx.report.dropped["issues"]["outside selection"] == 1
    assert "missing parent" not in ctx.report.dropped["issues"]


@pytest.mark.django_db
def test_self_fk_is_deferred(ctx, base):
    parent = issue_row(base, sequence_id=1)
    child = issue_row(base, sequence_id=2, parent_id=parent["id"])
    load_issues(ctx, child, parent)
    assert Issue.all_objects.get(pk=child["id"]).parent_id == parent["id"]


@pytest.mark.django_db
def test_soft_deleted_parent_still_links(ctx, base):
    deleted = issue_row(base, deleted_at=LATER)
    load_issues(ctx, deleted)
    comment = stamped(
        issue_id=deleted["id"],
        project_id=base["project"]["id"],
        workspace_id=base["workspace"]["id"],
        comment_html="<p>hi</p>",
    )
    assert load(Entity(IssueComment), FakeSource({"issue_comments": [comment]}), ctx) == 1
    assert IssueComment.all_objects.get(pk=comment["id"]).issue_id == deleted["id"]


@pytest.mark.django_db
def test_rerun_updates_in_place(ctx, base):
    row = issue_row(base)
    load_issues(ctx, row)
    ctx.allow_existing = True
    load_issues(ctx, {**row, "name": "Renamed"})
    issue = Issue.all_objects.get(pk=row["id"])
    assert (Issue.all_objects.filter(pk=row["id"]).count(), issue.name, issue.created_at) == (1, "Renamed", THEN)


@pytest.mark.django_db
def test_matched_user_fk_is_remapped(ctx, base):
    other = User.objects.create(email="b@example.test", username="b")
    source_user = ident()
    ctx.ids.add(User, source_user, other.id)
    row = issue_row(base, created_by_id=source_user)
    load_issues(ctx, row)
    assert Issue.all_objects.get(pk=row["id"]).created_by_id == other.id


@pytest.mark.django_db
def test_matched_user_id_in_html_is_rewritten(ctx, base):
    other = User.objects.create(email="b@example.test", username="b")
    source_user = ident()
    ctx.ids.add(User, source_user, other.id)
    html = f'<mention-component entity_identifier="{source_user}"></mention-component>'
    row = issue_row(base, description_html=html, description_binary=b"\x01")
    load_issues(ctx, row)
    issue = Issue.all_objects.get(pk=row["id"])
    assert str(other.id) in issue.description_html and str(source_user) not in issue.description_html
    assert issue.description_binary is None


@pytest.mark.django_db
def test_convert_and_keep(ctx, base):
    kept, dropped = issue_row(base, name="keep"), issue_row(base, name="drop", sequence_id=2)
    entity = Entity(
        Issue,
        convert={"priority": lambda row, ctx: "urgent"},
        keep=lambda row, ctx: True if row["name"] == "keep" else "unwanted",
    )
    load(entity, FakeSource({"issues": [kept, dropped]}), ctx)
    assert Issue.all_objects.get(pk=kept["id"]).priority == "urgent"
    assert ctx.report.dropped["issues"]["unwanted"] == 1


@pytest.mark.django_db
def test_null_into_not_null_field_takes_default(ctx):
    user = stamped(email="n@example.test", username="n", password="x", first_name=None)
    load(Entity(User), FakeSource({"users": [user]}), ctx)
    assert User.objects.get(pk=user["id"]).first_name == ""


@pytest.mark.django_db
def test_matched_user_id_in_uuid_field_is_rewritten(ctx, base):
    other = User.objects.create(email="b@example.test", username="b")
    source_user = ident()
    ctx.ids.add(User, source_user, other.id)
    issue = issue_row(base)
    load_issues(ctx, issue)
    activity = stamped(
        issue_id=issue["id"],
        project_id=base["project"]["id"],
        workspace_id=base["workspace"]["id"],
        verb="updated",
        field="assignees",
        new_identifier=source_user,
    )
    load(Entity(IssueActivity), FakeSource({"issue_activities": [activity]}), ctx)
    assert IssueActivity.all_objects.get(pk=activity["id"]).new_identifier == other.id


@pytest.mark.django_db
def test_rerun_keeps_skipped_fields_of_the_target(ctx):
    user = stamped(email="s@example.test", username="s", password="x", is_superuser=True)
    entity = Entity(User, skip=("is_superuser",))
    load(entity, FakeSource({"users": [user]}), ctx)
    ctx.allow_existing = True
    User.objects.filter(pk=user["id"]).update(is_superuser=True)
    load(entity, FakeSource({"users": [{**user, "is_superuser": False}]}), ctx)
    assert User.objects.get(pk=user["id"]).is_superuser is True


@pytest.mark.django_db
def test_existing_id_of_another_user_is_not_overwritten(ctx):
    victim = User.objects.create(email="victim@example.test", username="victim", password="keep")
    forged = stamped(id=victim.id, email="attacker@example.test", username="attacker", password="stolen")
    assert load(Entity(User), FakeSource({"users": [forged]}), ctx) == 0
    victim.refresh_from_db()
    assert (victim.email, victim.password) == ("victim@example.test", "keep")
    assert ctx.report.dropped["users"]["id already used in the target"] == 1


@pytest.mark.django_db
def test_rerun_cannot_overwrite_rows_of_another_workspace(ctx, base, create_user):
    other_ws = Workspace.objects.create(name="Other", slug="other", owner=create_user)
    other_project = Project.objects.create(name="O", identifier="OTH", workspace=other_ws)
    other_type = IssueType.objects.create(name="Task", workspace=other_ws)
    theirs = Issue.objects.create(name="Theirs", project=other_project, type=other_type)
    ctx.allow_existing = True
    load_issues(ctx, issue_row(base, id=theirs.id, name="Hijacked"))
    theirs.refresh_from_db()
    assert (theirs.name, theirs.workspace_id) == ("Theirs", other_ws.id)
    assert ctx.report.dropped["issues"]["id already used in the target"] == 1
