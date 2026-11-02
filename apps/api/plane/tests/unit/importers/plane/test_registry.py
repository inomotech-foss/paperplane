# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.apps import apps

from plane.importers.plane.catalog import skip_reason
from plane.importers.plane.registry import ENTITIES, IMPORTED

# PaperPlane's own tables, which a Plane database never fills.
NOT_FROM_PLANE = {
    "page_index_entries",
    "service_desk_configs",
    "issue_email_threads",
    "issue_email_messages",
    "application_installations",
    "automation_actions",
    "automation_projects",
}


def test_required_fks_point_backwards():
    loaded = set()
    for entity in ENTITIES:
        for f in entity.model._meta.concrete_fields:
            if f.is_relation and not f.null and f.attname not in entity.convert:
                assert f.related_model in loaded, f"{entity.table}.{f.attname} needs {f.related_model.__name__} first"
        loaded.add(entity.model)


def test_convert_and_skip_name_real_fields():
    for entity in ENTITIES:
        names = {f.attname for f in entity.model._meta.concrete_fields}
        assert set(entity.convert) <= names, entity.table
        assert set(entity.skip) <= names, entity.table


def test_each_table_loads_once():
    tables = [entity.table for entity in ENTITIES]
    assert len(tables) == len(set(tables))


def test_imported_tables_are_not_skipped():
    assert [table for table in IMPORTED if skip_reason(table)] == []


def test_every_target_model_table_is_decided():
    tables = {model._meta.db_table for model in apps.get_app_config("db").get_models()}
    undecided = sorted(t for t in tables if t not in IMPORTED and not skip_reason(t) and t not in NOT_FROM_PLANE)
    assert undecided == []
