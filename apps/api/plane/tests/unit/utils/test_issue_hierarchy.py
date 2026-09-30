# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date

import pytest

from plane.utils.issue_hierarchy import IssueTree, date_rollup


def tree(*rows):
    return IssueTree([{"id": i, "parent_id": p, **extra} for i, p, extra in rows])


@pytest.mark.unit
class TestIssueTree:
    def test_children_descendants_and_ancestors(self):
        t = tree(("c", None, {}), ("s", "c", {}), ("q", "s", {}), ("i1", "q", {}), ("i2", "q", {}))

        assert t.children("q") == ["i1", "i2"]
        assert sorted(t.descendants("c")) == ["i1", "i2", "q", "s"]
        assert t.ancestors("i2") == ["q", "s", "c"]
        assert t.ancestors("c") == []

    def test_a_parent_outside_the_tree_makes_a_root(self):
        t = tree(("story", "archived-customer", {}), ("quote", "story", {}))

        assert t.parent_id("story") is None
        assert t.ancestors("quote") == ["story"]

    def test_cycles_terminate(self):
        t = tree(("a", "b", {}), ("b", "a", {}), ("x", "x", {}))

        assert t.descendants("a") == ["b"]
        assert t.ancestors("a") == ["b"]
        assert t.parent_id("x") is None
        assert t.descendants("x") == []


@pytest.mark.unit
class TestDateRollup:
    def test_none_without_descendants(self):
        assert date_rollup(tree(("a", None, {})), "a") is None

    def test_single_dates_count_as_one_day(self):
        t = tree(
            ("p", None, {"start_date": None, "target_date": None}),
            ("only-end", "p", {"start_date": None, "target_date": date(2026, 9, 1)}),
            ("only-start", "p", {"start_date": date(2026, 1, 10), "target_date": None}),
        )

        assert date_rollup(t, "p") == {
            "start_date": date(2026, 1, 10),
            "target_date": date(2026, 9, 1),
            "children_count": 2,
            "descendants_count": 2,
        }
