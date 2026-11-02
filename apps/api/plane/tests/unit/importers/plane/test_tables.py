# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.importers.plane.tables import SKIPPED, TABLES, TableSpec, plan_columns, skip_reason


def test_plan_columns_intersects_and_applies_transforms():
    spec = TableSpec("issues", transforms={"archived_at": "archived_at::date"})
    cols = plan_columns(
        {"id": "uuid", "name": "text", "state_group": "text", "archived_at": "timestamptz"},
        {"id", "name", "archived_at", "type_id"},
        spec,
    )
    assert cols == ['archived_at::date AS "archived_at"', '"id" AS "id"', '"name" AS "name"']


def test_plan_columns_fills_required_target_only_columns():
    spec = TableSpec("projects", defaults={"issue_view": "true"})
    assert 'true AS "issue_view"' in plan_columns({"id": "uuid"}, {"id", "issue_view"}, spec)


def test_relation_type_transform_maps_definitions():
    spec = next(s for s in TABLES if s.name == "issue_relations")
    assert "work_item_relation_definitions" in spec.transforms["relation_type"]


def test_every_listed_table_is_copied_or_skipped_once():
    names = [s.name for s in TABLES]
    assert len(names) == len(set(names))
    assert not set(names) & set(SKIPPED)


def test_plan_columns_quotes_reserved_words():
    assert plan_columns({"group": "text"}, {"group"}, TableSpec("states")) == ['"group" AS "group"']


def test_imported_workspaces_default_to_plane_dialect():
    spec = next(s for s in TABLES if s.name == "workspaces")
    assert "'plane' AS \"pql_dialect\"" in plan_columns({"id": "uuid"}, {"id", "pql_dialect"}, spec)


def test_monthly_audit_log_partitions_are_skipped_whatever_the_month():
    assert skip_reason("audit_logs_2031_04") == skip_reason("audit_logs")
    assert skip_reason("audit_logs") is not None
    assert not any(name.startswith("audit_logs_2") for name in SKIPPED)


def test_unlisted_tables_have_no_skip_reason():
    assert skip_reason("issues") is None
    assert skip_reason("audit_logs_extra") is None
