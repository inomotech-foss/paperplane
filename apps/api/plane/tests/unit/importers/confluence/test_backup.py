# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.confluence.backup import _page_from_record


def record(**overrides):
    return {"id": 1, "title": "Page", **overrides}


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
        page = _page_from_record(record(labels=[{"id": "1", "name": "runbook"}]))

        assert set(page.labels) == {"runbook"}
