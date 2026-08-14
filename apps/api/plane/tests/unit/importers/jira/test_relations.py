# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.jira.backup import JiraLink
from plane.importers.jira.relations import resolve


def link(type_name, other_key, outward):
    return JiraLink(id="1", type_name=type_name, other_key=other_key, outward=outward)


@pytest.mark.unit
class TestLinkTypes:
    @pytest.mark.parametrize(
        ("type_name", "relation"),
        [
            ("Blocks", "blocked_by"),
            ("Duplicate", "duplicate"),
            ("Relates", "relates_to"),
            ("blocks", "blocked_by"),
        ],
    )
    def test_a_type_plane_knows_keeps_its_meaning(self, type_name, relation):
        assert resolve("DEMO-1", link(type_name, "DEMO-2", outward=True))[2:] == (relation, True)

    @pytest.mark.parametrize("type_name", ["Cloners", "Problem/Incident", "Causes", ""])
    def test_a_type_plane_cannot_name_is_downgraded(self, type_name):
        assert resolve("DEMO-1", link(type_name, "DEMO-2", outward=True))[2:] == ("relates_to", False)


@pytest.mark.unit
class TestDirection:
    def test_blocking_is_stored_on_the_blocked_issue(self):
        """Plane keeps only `blocked_by`, so "DEMO-1 blocks DEMO-2" is stored as
        "DEMO-2 blocked_by DEMO-1"."""
        first, second, relation, _ = resolve("DEMO-1", link("Blocks", "DEMO-2", outward=True))

        assert (first, second, relation) == ("DEMO-2", "DEMO-1", "blocked_by")

    def test_both_ends_of_a_link_resolve_to_the_same_row(self):
        """Jira writes the link on both issues, so the pair has to come out
        identical whichever side it is read from."""
        outward = resolve("DEMO-1", link("Blocks", "DEMO-2", outward=True))
        inward = resolve("DEMO-2", link("Blocks", "DEMO-1", outward=False))

        assert outward == inward

    def test_a_symmetric_link_has_one_canonical_order(self):
        assert resolve("DEMO-9", link("Relates", "DEMO-2", outward=True))[:2] == ("DEMO-2", "DEMO-9")
        assert resolve("DEMO-2", link("Relates", "DEMO-9", outward=False))[:2] == ("DEMO-2", "DEMO-9")
