# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.confluence.repair import repair_page_html


@pytest.mark.unit
class TestRepair:
    def test_a_page_without_tables_is_returned_as_is(self) -> None:
        html = "<p>a&nbsp;b</p>"

        result = repair_page_html(html)

        assert result.html is html
        assert not result.has_tables

    def test_counts_the_tables(self) -> None:
        result = repair_page_html("<table><tr><td>a</td></tr></table><table><tr><td>b</td></tr></table>")

        assert result.tables == 2
        assert result.has_tables

    def test_normalises_the_tables(self) -> None:
        result = repair_page_html('<table class="wrapped"><tbody><tr><td colspan="1">Year</td></tr></tbody></table>')

        assert "wrapped" not in result.html
        assert "<td><p>Year</p></td>" in result.html

    def test_repairing_twice_changes_nothing_more(self) -> None:
        once = repair_page_html('<table><tr><th colspan="1">Frequency</th><td>Year</td></tr></table>').html

        assert repair_page_html(once).html == once

    def test_empty_html(self) -> None:
        assert repair_page_html("").html == ""
