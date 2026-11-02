# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""`import_plane` against a real Plane-shaped schema that drifts from PaperPlane's.

The source schema is written by hand, not taken from the models: it has a
column PaperPlane lacks, lacks columns PaperPlane has, keeps `archived_at` as
a timestamp, and has neither of the Commercial link tables. The import must
take it as it is.
"""

import uuid
from datetime import date, datetime, timezone
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from psycopg.conninfo import make_conninfo

from plane.db.models import Issue, IssueActivity, IssueComment, IssueLabel, Project, User, Workspace

SCHEMA = "plane_import_src"
THEN = datetime(2024, 5, 1, 9, 30, tzinfo=timezone.utc)
ARCHIVED = datetime(2024, 6, 1, 22, 0, tzinfo=timezone.utc)

DDL = """
CREATE TABLE {s}.users (id uuid, email text, username text, password text, display_name text, first_name text,
    last_name text, is_active boolean, created_at timestamptz, updated_at timestamptz, signup_ip text);
CREATE TABLE {s}.workspaces (id uuid, name text, slug text, owner_id uuid, created_at timestamptz,
    updated_at timestamptz);
CREATE TABLE {s}.workspace_members (id uuid, workspace_id uuid, member_id uuid, role int, created_at timestamptz,
    updated_at timestamptz);
CREATE TABLE {s}.projects (id uuid, name text, identifier text, workspace_id uuid, network int,
    created_by_id uuid, created_at timestamptz, updated_at timestamptz, start_date date);
CREATE TABLE {s}.project_members (id uuid, project_id uuid, workspace_id uuid, member_id uuid, role int);
CREATE TABLE {s}.states (id uuid, name text, "group" text, color text, project_id uuid, workspace_id uuid,
    sequence float, "default" boolean);
CREATE TABLE {s}.issue_types (id uuid, name text, workspace_id uuid, is_default boolean, is_epic boolean,
    logo_props jsonb);
CREATE TABLE {s}.project_issue_types (id uuid, project_id uuid, issue_type_id uuid, workspace_id uuid,
    is_default boolean);
CREATE TABLE {s}.issues (id uuid, name text, sequence_id int, project_id uuid, workspace_id uuid, state_id uuid,
    type_id uuid, parent_id uuid, priority text, description_html text, created_by_id uuid,
    created_at timestamptz, updated_at timestamptz, archived_at timestamptz, deleted_at timestamptz,
    priority_rank int);
CREATE TABLE {s}.issue_sequences (id uuid, issue_id uuid, project_id uuid, workspace_id uuid, sequence bigint,
    deleted boolean);
CREATE TABLE {s}.issue_comments (id uuid, issue_id uuid, project_id uuid, workspace_id uuid, comment_html text,
    actor_id uuid, created_by_id uuid, created_at timestamptz, updated_at timestamptz);
CREATE TABLE {s}.issue_activities (id uuid, issue_id uuid, project_id uuid, workspace_id uuid, actor_id uuid,
    verb text, field text, old_value text, new_value text, created_at timestamptz, updated_at timestamptz);
CREATE TABLE {s}.labels (id uuid, name text, color text, project_id uuid, workspace_id uuid);
CREATE TABLE {s}.issue_labels (id uuid, issue_id uuid, label_id uuid, project_id uuid, workspace_id uuid);
CREATE TABLE {s}.sessions (session_key text);
CREATE TABLE {s}.shiny_new_feature (id uuid);
"""


def source_dsn():
    settings = connection.settings_dict
    return make_conninfo(
        dbname=settings["NAME"],
        user=settings["USER"],
        password=settings["PASSWORD"],
        host=settings["HOST"],
        port=settings["PORT"] or 5432,
    )


def insert(cursor, table, **values):
    columns = ", ".join(f'"{name}"' for name in values)
    marks = ", ".join(["%s"] * len(values))
    cursor.execute(f"INSERT INTO {SCHEMA}.{table} ({columns}) VALUES ({marks})", list(values.values()))


@pytest.fixture
def plane_db(transactional_db):
    ids = {name: uuid.uuid4() for name in ("ada", "ws", "project", "state", "type", "issue", "label")}
    ws = {"workspace_id": ids["ws"]}
    pj = {"project_id": ids["project"], **ws}
    stamps = {"created_at": THEN, "updated_at": THEN}
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE SCHEMA {SCHEMA}")
        cursor.execute(DDL.format(s=SCHEMA))
        insert(
            cursor,
            "users",
            id=ids["ada"],
            email="ada@example.test",
            username="ada",
            password="x$hash",
            display_name="ada",
            is_active=True,
            signup_ip="10.0.0.1",
            **stamps,
        )
        insert(cursor, "workspaces", id=ids["ws"], name="Acme", slug="acme", owner_id=ids["ada"], **stamps)
        insert(cursor, "workspace_members", id=uuid.uuid4(), member_id=ids["ada"], role=20, **ws, **stamps)
        insert(
            cursor,
            "projects",
            id=ids["project"],
            name="Alpha",
            identifier="ABC",
            network=2,
            created_by_id=ids["ada"],
            start_date=date(2024, 1, 1),
            **ws,
            **stamps,
        )
        insert(cursor, "project_members", id=uuid.uuid4(), member_id=ids["ada"], role=20, **pj)
        insert(
            cursor,
            "states",
            id=ids["state"],
            name="Todo",
            group="unstarted",
            color="#000",
            sequence=1.0,
            default=True,
            **pj,
        )
        insert(
            cursor,
            "issue_types",
            id=ids["type"],
            name="Task",
            is_default=True,
            is_epic=False,
            logo_props='{"in_use": "icon", "icon": {"name": "Task", "background_color": "#6695FF"}}',
            **ws,
        )
        insert(cursor, "project_issue_types", id=uuid.uuid4(), issue_type_id=ids["type"], is_default=True, **pj)
        insert(
            cursor,
            "issues",
            id=ids["issue"],
            name="First",
            sequence_id=1,
            state_id=ids["state"],
            type_id=None,
            priority="high",
            description_html="<p>body</p><script>alert(1)</script>",
            created_by_id=ids["ada"],
            archived_at=ARCHIVED,
            priority_rank=2,
            **pj,
            **stamps,
        )
        insert(cursor, "issue_sequences", id=uuid.uuid4(), issue_id=ids["issue"], sequence=1, deleted=False, **pj)
        insert(
            cursor,
            "issue_comments",
            id=uuid.uuid4(),
            issue_id=ids["issue"],
            comment_html="<p>hi</p>",
            actor_id=ids["ada"],
            created_by_id=ids["ada"],
            **pj,
            **stamps,
        )
        insert(
            cursor,
            "issue_activities",
            id=uuid.uuid4(),
            issue_id=ids["issue"],
            actor_id=ids["ada"],
            verb="updated",
            field="priority",
            old_value="none",
            new_value="high",
            **pj,
            **stamps,
        )
        insert(cursor, "labels", id=ids["label"], name="bug", color="#f00", **pj)
        insert(cursor, "issue_labels", id=uuid.uuid4(), issue_id=ids["issue"], label_id=ids["label"], **pj)
        insert(cursor, "sessions", session_key="abc")
        insert(cursor, "shiny_new_feature", id=uuid.uuid4())
    try:
        yield ids
    finally:
        with connection.cursor() as cursor:
            cursor.execute(f"DROP SCHEMA {SCHEMA} CASCADE")


def run_import(**options):
    out = StringIO()
    call_command(
        "import_plane", source_dsn=source_dsn(), source_schema=SCHEMA, web_url="http://pp.test", stdout=out, **options
    )
    return out.getvalue()


def test_imports_a_drifted_plane_schema(plane_db):
    output = run_import()

    issue = Issue.all_objects.get(pk=plane_db["issue"])
    assert f"{issue.project.identifier}-{issue.sequence_id}" == "ABC-1"
    assert (issue.created_at, issue.created_by.email, issue.type_id) == (THEN, "ada@example.test", plane_db["type"])
    assert issue.archived_at == date(2024, 6, 1)
    assert IssueLabel.objects.get(issue=issue).label.name == "bug"

    comment = IssueComment.all_objects.get(issue=issue)
    activity = IssueActivity.all_objects.get(issue=issue)
    assert (comment.actor_id, comment.created_at) == (plane_db["ada"], THEN)
    assert (activity.actor_id, activity.created_at, activity.new_value) == (plane_db["ada"], THEN, "high")

    assert Workspace.objects.get(slug="acme").pql_dialect == "plane"
    assert Project.objects.get(pk=plane_db["project"]).timezone == "UTC"
    assert User.objects.get(pk=plane_db["ada"]).password == "x$hash"

    assert "sessions" in output and "shiny_new_feature" in output
    assert "script" not in issue.description_html
    assert "sanitized    issues: 1" in output
    assert "cannot tell which Plane version" in output


def test_refuses_then_reruns_with_allow_existing(plane_db):
    run_import()
    counts = (Issue.all_objects.count(), IssueComment.all_objects.count(), IssueActivity.all_objects.count())
    with pytest.raises(CommandError, match="allow-existing"):
        run_import()
    run_import(allow_existing=True)
    assert counts == (Issue.all_objects.count(), IssueComment.all_objects.count(), IssueActivity.all_objects.count())


def test_dry_run_writes_nothing(plane_db):
    output = run_import(dry_run=True)
    assert "dry run, rolled back" in output
    assert not Workspace.objects.filter(slug="acme").exists()


def test_user_map_matches_an_existing_account(plane_db, tmp_path):
    existing = User.objects.create(email="ada.lovelace@example.test", username="lovelace")
    user_map = tmp_path / "users.csv"
    user_map.write_text("ada@example.test,ada.lovelace@example.test\n")
    output = run_import(user_map=str(user_map))
    assert "1 matched" in output
    assert Issue.all_objects.get(pk=plane_db["issue"]).created_by_id == existing.id
