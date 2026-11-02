# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from datetime import date, datetime, timezone

import pytest

from plane.importers.plane.convert import archived_date, constant, material_icon, page_links, relation_type
from plane.importers.plane.entities import Context
from plane.importers.plane.ids import IdMap
from plane.importers.plane.report import ImportReport

from .fakes import FakeSource

THEN = datetime(2024, 5, 1, 23, 30, tzinfo=timezone.utc)


@pytest.fixture
def ctx():
    return Context(ids=IdMap(), report=ImportReport(), web_url="http://pp.test/")


def icon(ctx, name, logo_props):
    return material_icon({"name": name, "logo_props": logo_props}, ctx)


def test_plane_type_icons_become_material_icons(ctx):
    assert icon(ctx, "Epic", {"in_use": "icon", "icon": {"name": "Epic", "background_color": "#999AA0"}}) == {
        "in_use": "icon",
        "icon": {"name": "stacks", "color": "#999AA0"},
    }
    assert icon(ctx, "Build", {"in_use": "icon", "icon": {"name": "Code", "background_color": "#4C49F8"}}) == {
        "in_use": "icon",
        "icon": {"name": "code", "color": "#4C49F8"},
    }
    assert icon(ctx, "Task", {"in_use": "icon", "icon": {"color": "#ffffff", "background_color": "#6695FF"}}) == {
        "in_use": "icon",
        "icon": {"name": "task_alt", "color": "#6695FF"},
    }
    assert icon(ctx, "Task", {}) == {"in_use": "icon", "icon": {"name": "task_alt", "color": "#6b7280"}}
    assert icon(ctx, "Epic", None) == {"in_use": "icon", "icon": {"name": "stacks", "color": "#6b7280"}}
    assert [counter for counter, _ in ctx.notes] == ["type_icons"] * 5


def test_emoji_icons_are_left_alone(ctx):
    emoji = {"in_use": "emoji", "emoji": {"value": "128027"}}
    assert icon(ctx, "Bug", emoji) == emoji
    assert ctx.notes == []


def test_archived_date():
    assert archived_date({"archived_at": THEN}, None) == date(2024, 5, 1)
    assert archived_date({"archived_at": None}, None) is None
    assert archived_date({}, None) is None


def test_constant():
    assert constant("plane")({}, None) == "plane"


def test_relation_type_is_kept(ctx):
    assert relation_type({"relation_type": "blocked_by"}, ctx) == "blocked_by"


def test_relation_definition_name_is_used(ctx):
    definition = uuid.uuid4()
    ctx.state["relation_definitions"] = {definition: "Relates to"}
    assert relation_type({"relation_type": "", "definition_id": definition}, ctx) == "relates_to"


def test_unknown_relation_type_becomes_relates_to(ctx):
    definition = uuid.uuid4()
    ctx.state["relation_definitions"] = {definition: "Caused by"}
    assert relation_type({"relation_type": None, "definition_id": definition}, ctx) == "relates_to"
    assert relation_type({"relation_type": "clones"}, ctx) == "relates_to"
    assert [counter for counter, _ in ctx.notes] == ["relations_downgraded"] * 2


def test_page_link_url_and_title(ctx):
    workspace, project, issue, page, link = (uuid.uuid4() for _ in range(5))
    source = FakeSource(
        {
            "workspaces": [{"id": workspace, "slug": "acme"}],
            "pages": [{"id": page, "name": "Runbook"}],
            "workitem_pages": [
                {
                    "id": link,
                    "issue_id": issue,
                    "page_id": page,
                    "project_id": project,
                    "workspace_id": workspace,
                    "created_at": THEN,
                    "updated_at": THEN,
                    "created_by_id": None,
                    "deleted_at": None,
                },
                {"id": uuid.uuid4(), "issue_id": uuid.uuid4(), "page_id": page, "workspace_id": workspace},
            ],
        }
    )
    rows = {row["id"]: row for row in page_links(source, ctx)}
    assert len(rows) == 2
    assert rows[link]["issue_id"] == issue
    assert rows[link]["title"] == "Runbook"
    assert rows[link]["url"] == f"http://pp.test/acme/projects/{project}/pages/{page}/"
    assert rows[link]["created_at"] == THEN
