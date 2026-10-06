# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.importers.confluence.backup import (
    SORT_STEP,
    ConfluenceBackup,
    _page_from_record,
    add_container_placeholders,
    drop_template_scaffolding,
    sibling_sort_orders,
)


def record(**overrides):
    return {"id": 1, "title": "Page", **overrides}


def page(page_id, title, parent=None, body="", parent_type=None, position=None, **extra):
    record = {"id": page_id, "title": title, "parentId": parent, "body": {"storage": {"value": body}}, **extra}
    if parent_type:
        record["parentType"] = parent_type
    if position is not None:
        record["position"] = position
    return _page_from_record(record)


def titles(pages):
    return sorted(item.title for item in pages)


@pytest.mark.unit
class TestLabels:
    def test_label_objects_become_names(self):
        labels = [
            {"id": "403374122", "name": "all-hands-meeting", "prefix": "global"},
            {"id": "1", "name": "runbook", "prefix": "global"},
        ]

        assert _page_from_record(record(labels=labels)).labels == ["all-hands-meeting", "runbook"]

    def test_bare_strings_still_work(self):
        assert _page_from_record(record(labels=["runbook"])).labels == ["runbook"]

    @pytest.mark.parametrize("labels", [None, [], [{}], [{"id": "1"}], [""]])
    def test_nameless_labels_are_dropped(self, labels):
        """A label with no name would otherwise reach the loader, which keys
        Label rows by name and puts them in a set."""
        assert _page_from_record(record(labels=labels)).labels == []

    def test_names_are_hashable(self):
        """The loader builds a set across pages, so a dict here raises."""
        parsed = _page_from_record(record(labels=[{"id": "1", "name": "runbook"}]))

        assert set(parsed.labels) == {"runbook"}


@pytest.mark.unit
class TestTemplateScaffolding:
    def test_container_is_unwrapped_and_children_become_roots(self):
        pages = [page("1", "_root"), page("2", "Policy", parent="1"), page("3", "Scope", parent="2")]

        kept = drop_template_scaffolding(pages)

        assert titles(kept) == ["Policy", "Scope"]
        assert {item.title: item.parent_id for item in kept} == {"Policy": None, "Scope": "2"}

    def test_trash_subtree_is_dropped(self):
        pages = [
            page("1", "_trash"),
            page("2", "Deleted", parent="1"),
            page("3", "Deeper", parent="2"),
            page("4", "Kept"),
        ]

        assert titles(drop_template_scaffolding(pages)) == ["Kept"]

    def test_snippets_are_content(self):
        """The include macros point at these, so removing them breaks pages."""
        pages = [page("1", "_snippets"), page("2", "Header", parent="1")]

        assert titles(drop_template_scaffolding(pages)) == ["Header", "_snippets"]

    def test_container_holding_a_body_is_left_alone(self):
        pages = [page("1", "_root", body="<p>real</p>"), page("2", "Child", parent="1")]

        assert titles(drop_template_scaffolding(pages)) == ["Child", "_root"]

    def test_space_without_scaffolding_is_untouched(self):
        pages = [page("1", "Home"), page("2", "Policy", parent="1")]

        assert drop_template_scaffolding(pages) is pages

    def test_nested_container_is_not_a_root(self):
        """Only a space-level `_root` is scaffolding."""
        pages = [page("1", "Home"), page("2", "_root", parent="1")]

        assert titles(drop_template_scaffolding(pages)) == ["Home", "_root"]


@pytest.mark.unit
class TestSite:
    def _backup(self, tmp_path, manifest=None, projects=None):
        if manifest is not None:
            (tmp_path / "manifest.json").write_text(json.dumps(manifest))
        if projects is not None:
            (tmp_path / "jira").mkdir()
            (tmp_path / "jira" / "projects.json").write_text(json.dumps(projects))
        return ConfluenceBackup(tmp_path, "SPACE")

    def test_the_site_becomes_a_base_url(self, tmp_path):
        assert (
            self._backup(tmp_path, manifest={"site": "example.atlassian.net"}).site() == "https://example.atlassian.net"
        )

    def test_a_site_that_is_already_a_url_is_kept(self, tmp_path):
        assert self._backup(tmp_path, manifest={"site": "https://example.atlassian.net/"}).site() == (
            "https://example.atlassian.net"
        )

    @pytest.mark.parametrize("manifest", [None, {}, {"site": ""}])
    def test_a_backup_naming_no_site_reports_none(self, tmp_path, manifest):
        assert self._backup(tmp_path, manifest=manifest).site() == ""

    def test_jira_project_keys_are_upper_case(self, tmp_path):
        backup = self._backup(tmp_path, projects=[{"key": "abc"}, {"key": "DEF"}])

        assert backup.jira_project_keys() == {"ABC", "DEF"}

    def test_a_backup_without_jira_has_no_keys(self, tmp_path):
        assert self._backup(tmp_path).jira_project_keys() == set()


@pytest.mark.unit
class TestSpaceType:
    def _write_space_json(self, tmp_path, content):
        space_dir = tmp_path / "confluence" / "DEMO"
        space_dir.mkdir(parents=True)
        (space_dir / "space.json").write_text(content)
        return ConfluenceBackup(tmp_path, "DEMO")

    def test_a_personal_space_reports_its_type(self, tmp_path):
        backup = self._write_space_json(tmp_path, json.dumps({"key": "DEMO", "type": "personal"}))

        assert backup.space_type() == "personal"

    def test_a_global_space_reports_its_type(self, tmp_path):
        backup = self._write_space_json(tmp_path, json.dumps({"key": "DEMO", "type": "global"}))

        assert backup.space_type() == "global"

    def test_a_missing_type_key_is_empty(self, tmp_path):
        backup = self._write_space_json(tmp_path, json.dumps({"key": "DEMO"}))

        assert backup.space_type() == ""

    def test_a_missing_space_json_is_empty(self, tmp_path):
        assert ConfluenceBackup(tmp_path, "MISSING").space_type() == ""

    def test_malformed_space_json_is_empty(self, tmp_path):
        backup = self._write_space_json(tmp_path, "{not valid json")

        assert backup.space_type() == ""


@pytest.mark.unit
class TestRecordFields:
    def test_parent_type_defaults_to_page_when_a_parent_exists(self):
        assert page("2", "Child", parent="1").parent_type == "page"
        assert page("2", "Child", parent="1", parent_type="folder").parent_type == "folder"

    def test_root_has_no_parent_type(self):
        assert page("1", "Root", parent_type="page").parent_type is None

    @pytest.mark.parametrize(("raw", "expected"), [(7, 7), ("12", 12), (None, None), ("x", None)])
    def test_position_is_an_int_or_absent(self, raw, expected):
        assert page("1", "Root", position=raw).position == expected

    def test_archived_status(self):
        assert page("1", "Old", status="archived").archived is True
        assert page("1", "Live", status="current").archived is False


@pytest.mark.unit
class TestContainerPlaceholders:
    def test_pages_under_one_folder_share_a_placeholder(self):
        pages = [
            page("1", "Home"),
            page("2", "A", parent="50", parent_type="folder"),
            page("3", "B", parent="50", parent_type="folder"),
        ]

        kept = add_container_placeholders(pages)

        assert titles(kept) == ["A", "B", "Folder 50", "Home"]
        folder = next(item for item in kept if item.placeholder)
        assert (folder.id, folder.parent_id, folder.body) == ("folder-50", None, "")
        assert {item.title: item.parent_id for item in kept if not item.placeholder} == {
            "Home": None,
            "A": "folder-50",
            "B": "folder-50",
        }
        assert all(item.parent_type == "page" for item in kept if item.parent_id)

    def test_database_parents_get_their_own_placeholder(self):
        kept = add_container_placeholders([page("2", "Row", parent="7", parent_type="database")])

        assert titles(kept) == ["Database 7", "Row"]

    def test_name_is_recovered_from_a_link_with_real_text(self):
        body = (
            '<p><a href="https://x.atlassian.net/wiki/spaces/OPS/folder/50">Back office</a> and '
            '<a href="https://x.atlassian.net/wiki/spaces/OPS/folder/51">https://x.atlassian.net/wiki/spaces/OPS/folder/51</a></p>'
        )
        pages = [
            page("1", "Home", body=body),
            page("2", "A", parent="50", parent_type="folder"),
            page("3", "B", parent="51", parent_type="folder"),
        ]

        assert titles(add_container_placeholders(pages)) == ["A", "B", "Back office", "Folder 51", "Home"]

    def test_placeholder_timestamps_span_its_pages(self):
        pages = [
            page("2", "A", parent="50", parent_type="folder", createdAt="2024-01-05T00:00:00Z"),
            page("3", "B", parent="50", parent_type="folder", createdAt="2024-01-01T00:00:00Z"),
        ]

        folder = next(item for item in add_container_placeholders(pages) if item.placeholder)

        assert (folder.created_at.day, folder.updated_at.day) == (1, 5)

    def test_folder_that_is_in_the_export_is_left_alone(self):
        """A parentType the export does hold a record for needs no stand-in."""
        pages = [page("50", "Real", parent=None), page("2", "A", parent="50", parent_type="folder")]

        assert titles(add_container_placeholders(pages)) == ["A", "Real"]

    def test_missing_page_parent_is_not_a_container(self):
        """Pages under an unexported page stay roots, as before."""
        pages = [page("2", "A", parent="50")]

        assert titles(add_container_placeholders(pages)) == ["A"]


@pytest.mark.unit
class TestSiblingSortOrders:
    def test_siblings_follow_position(self):
        pages = [
            page("1", "Home"),
            page("2", "Second", parent="1", position=20),
            page("3", "First", parent="1", position=10),
        ]

        orders = sibling_sort_orders(pages)

        assert orders == {"1": SORT_STEP, "3": SORT_STEP, "2": 2 * SORT_STEP}

    def test_unpositioned_pages_go_last_by_title(self):
        pages = [
            page("2", "Zed", parent="1", position=5),
            page("3", "Beta", parent="1"),
            page("4", "Alpha", parent="1"),
        ]

        orders = sibling_sort_orders(pages)

        assert [orders[page_id] for page_id in ("2", "4", "3")] == [SORT_STEP, 2 * SORT_STEP, 3 * SORT_STEP]

    def test_pages_under_an_unexported_parent_rank_with_the_roots(self):
        pages = [page("1", "Home", position=1), page("2", "Lost", parent="99", position=0)]

        orders = sibling_sort_orders(pages)

        assert orders == {"2": SORT_STEP, "1": 2 * SORT_STEP}


@pytest.mark.unit
class TestSpaceFields:
    def test_status_and_owner(self, tmp_path):
        space_dir = tmp_path / "confluence" / "DEMO"
        space_dir.mkdir(parents=True)
        (space_dir / "space.json").write_text(
            json.dumps({"key": "DEMO", "status": "archived", "spaceOwnerId": "acc-1"})
        )

        backup = ConfluenceBackup(tmp_path, "DEMO")

        assert (backup.space_status(), backup.space_owner_id()) == ("archived", "acc-1")

    def test_missing_space_json_is_empty(self, tmp_path):
        backup = ConfluenceBackup(tmp_path, "NOPE")

        assert (backup.space_status(), backup.space_owner_id()) == ("", "")
