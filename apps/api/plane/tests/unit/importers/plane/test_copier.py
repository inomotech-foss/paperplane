# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from datetime import datetime, timezone

import pytest
from django.db import connection

from plane.db.models import Workspace, WorkspaceUserProperties
from plane.importers.plane.copier import MissingTableError, copy_table
from plane.importers.plane.tables import TableSpec

from .fakes import FakeSource

WORKSPACE_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
CREATED = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)


def workspace_row(owner, name="Imported"):
    return {
        "id": WORKSPACE_ID,
        "name": name,
        "slug": "imported",
        "owner_id": owner.id,
        "created_at": CREATED,
        "updated_at": CREATED,
        "created_by_id": None,
        "timezone": "UTC",
        "background_color": "#000000",
        "commercial_only": "dropped",
    }


@pytest.mark.django_db
def test_copy_keeps_id_and_timestamps(create_user):
    source = FakeSource({"workspaces": [workspace_row(create_user)]})
    with connection.cursor() as cursor:
        assert copy_table(source, TableSpec("workspaces"), cursor) == 1
    workspace = Workspace.objects.get(id=WORKSPACE_ID)
    assert workspace.created_at == CREATED
    assert workspace.created_by_id is None


@pytest.mark.django_db
def test_copy_twice_updates_in_place(create_user):
    source = FakeSource({"workspaces": [workspace_row(create_user)]})
    with connection.cursor() as cursor:
        copy_table(source, TableSpec("workspaces"), cursor)
        source.tables["workspaces"] = [workspace_row(create_user, name="Renamed")]
        copy_table(source, TableSpec("workspaces"), cursor)
    assert Workspace.objects.filter(id=WORKSPACE_ID).count() == 1
    assert Workspace.objects.get(id=WORKSPACE_ID).name == "Renamed"


@pytest.mark.django_db
def test_missing_target_table_raises():
    with connection.cursor() as cursor, pytest.raises(MissingTableError):
        copy_table(FakeSource(), TableSpec("no_such_table"), cursor)


@pytest.mark.django_db
def test_copy_writes_json_columns(create_user):
    workspace = Workspace.objects.create(name="json", slug="json", owner=create_user)
    filters = {"priority": ["urgent"], "state_group": None}
    row = {
        "id": uuid.uuid4(),
        "workspace_id": workspace.id,
        "user_id": create_user.id,
        "created_at": CREATED,
        "updated_at": CREATED,
        "filters": filters,
        "display_filters": {},
        "display_properties": {},
        "rich_filters": {},
        "navigation_control_preference": "ACCORDION",
        "navigation_project_limit": 10,
    }
    json_types = dict.fromkeys(["filters", "display_filters", "display_properties", "rich_filters"], "jsonb")
    source = FakeSource({"workspace_user_properties": [row]}, types=json_types)
    with connection.cursor() as cursor:
        copy_table(source, TableSpec("workspace_user_properties"), cursor)
    assert WorkspaceUserProperties.objects.get(id=row["id"]).filters == filters
