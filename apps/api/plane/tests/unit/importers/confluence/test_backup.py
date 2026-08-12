# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.importers.confluence.backup import ConfluenceBackup, _page_from_record, drop_template_scaffolding


def record(**overrides):
    return {"id": 1, "title": "Page", **overrides}


def page(page_id, title, parent=None, body=""):
    return _page_from_record({"id": page_id, "title": title, "parentId": parent, "body": {"storage": {"value": body}}})


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
