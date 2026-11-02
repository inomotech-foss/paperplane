# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from datetime import datetime, timezone

import pytest
from django.db import connection

from plane.db.models import Issue, IssueLink, IssueType, Project, Workspace
from plane.importers.plane.fixups import link_work_item_pages
from plane.importers.plane.loader import (
    ImportConflict,
    ImportRefused,
    OrphanRowsError,
    PlaneImporter,
    UnhandledTablesError,
)

from .fakes import FakeSource

NOW = datetime(2026, 3, 1, tzinfo=timezone.utc)


def workspace_row(owner, slug="imported"):
    return {
        "id": uuid.uuid4(),
        "name": slug,
        "slug": slug,
        "owner_id": owner.id,
        "created_at": NOW,
        "updated_at": NOW,
        "timezone": "UTC",
        "background_color": "#000000",
    }


@pytest.mark.django_db
def test_refuses_target_with_workspaces(create_user):
    Workspace.objects.create(name="existing", slug="existing", owner=create_user)
    source = FakeSource({"workspaces": [workspace_row(create_user)]})
    with pytest.raises(ImportRefused):
        PlaneImporter(source, web_url="http://pp.test").run()
    report = PlaneImporter(source, web_url="http://pp.test", allow_existing=True).run()
    assert report.copied["workspaces"] == 1


@pytest.mark.django_db
def test_dry_run_leaves_no_rows(create_user):
    source = FakeSource({"workspaces": [workspace_row(create_user)]})
    report = PlaneImporter(source, web_url="http://pp.test").run(dry_run=True)
    assert report.dry_run
    assert report.copied["workspaces"] == 1
    assert Workspace.objects.count() == 0


@pytest.mark.django_db
def test_orphan_rows_abort(create_user):
    row = workspace_row(create_user)
    assignment = {
        "id": uuid.uuid4(),
        "issue_id": uuid.uuid4(),
        "assignee_id": create_user.id,
        "project_id": uuid.uuid4(),
        "workspace_id": row["id"],
        "created_at": NOW,
        "updated_at": NOW,
    }
    source = FakeSource({"workspaces": [row], "issue_assignees": [assignment]})
    with pytest.raises(OrphanRowsError) as error:
        PlaneImporter(source, web_url="http://pp.test").run()
    assert any(key.startswith("issue_assignees.") for key in error.value.orphans)
    assert Workspace.objects.count() == 0


@pytest.mark.django_db
def test_page_link_becomes_issue_link(create_user):
    workspace = Workspace.objects.create(name="pages", slug="pages", owner=create_user)
    project = Project.objects.create(name="Pages", identifier="PG", workspace=workspace)
    issue_type = IssueType.objects.create(workspace=workspace, name="Task")
    issue = Issue.objects.create(name="item", project=project, workspace=workspace, type=issue_type)
    page_id = uuid.uuid4()
    link = {
        "id": uuid.uuid4(),
        "issue_id": issue.id,
        "project_id": project.id,
        "workspace_id": workspace.id,
        "page_id": page_id,
        "created_at": NOW,
        "updated_at": NOW,
        "created_by_id": create_user.id,
        "deleted_at": None,
        "title": "Spec",
        "workspace_slug": "pages",
    }
    with connection.cursor() as cursor:
        assert link_work_item_pages(FakeSource({"workitem_pages": [link]}), cursor, "http://pp.test") == 1
    saved = IssueLink.objects.get(id=link["id"])
    assert saved.title == "Spec"
    assert saved.url == f"http://pp.test/pages/projects/{project.id}/pages/{page_id}/"
    assert saved.created_at == NOW


@pytest.mark.django_db
def test_unique_key_clash_is_reported(create_user):
    Workspace.objects.create(name="existing", slug="imported", owner=create_user)
    source = FakeSource({"workspaces": [workspace_row(create_user, slug="imported")]})
    with pytest.raises(ImportConflict) as error:
        PlaneImporter(source, web_url="http://pp.test", allow_existing=True).run()
    assert "workspaces" in str(error.value)
    assert Workspace.objects.count() == 1


@pytest.mark.django_db
def test_unhandled_source_tables_stop_before_writing(create_user):
    reaction = {"id": uuid.uuid4(), "reaction": "+1"}
    source = FakeSource({"workspaces": [workspace_row(create_user)], "issue_reactions": [reaction]})
    with pytest.raises(UnhandledTablesError) as error:
        PlaneImporter(source, web_url="http://pp.test").run()
    assert "issue_reactions" in str(error.value)
    assert Workspace.objects.count() == 0


@pytest.mark.django_db
def test_imported_type_icons_become_material_icons(create_user):
    row = workspace_row(create_user)
    epic = {
        "id": uuid.uuid4(),
        "workspace_id": row["id"],
        "name": "Epic",
        "description": "",
        "is_active": True,
        "level": 0,
        "logo_props": {"in_use": "icon", "icon": {"name": "Epic", "background_color": "#999AA0"}},
        "created_at": NOW,
        "updated_at": NOW,
    }
    source = FakeSource({"workspaces": [row], "issue_types": [epic]}, types={"logo_props": "jsonb"})
    report = PlaneImporter(source, web_url="http://pp.test").run()
    assert report.type_icons == 1
    assert IssueType.objects.get(id=epic["id"]).logo_props["icon"]["name"] == "stacks"
