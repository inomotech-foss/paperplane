# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The table normaliser, on markup taken from an imported ISO 27001 space."""

import pytest
from bs4 import BeautifulSoup

from plane.importers.confluence.tables import (
    KEY_COLUMN_WIDTH,
    normalise_tables_html,
)

LINK = '<a href="/ws/projects/11111111-1111-4111-8111-111111111111/pages/22222222-2222-4222-8222-222222222222/">'

# "10.1 General": header cells down the first column, a highlighted cell whose
# content Confluence wrapped in a content-wrapper div, colspan="1" everywhere.
CONTROL_DETAILS = (
    '<table class="wrapped"><tbody>'
    '<tr><th>Requirement</th><td background="var(--editor-colors-orange-background)" class="highlight-yellow">'
    '<div class="content-wrapper"><p><span style="color: rgb(9,30,66);">The organization shall continually '
    "improve the suitability, adequacy and effectiveness of the information security management system.</span></p>"
    "</div></td></tr>"
    '<tr><th colspan="1">Instruction</th><td colspan="1">Write down how your organization continually improves '
    "the suitability and effectiveness of the ISMS.</td></tr>"
    "<tr><th>Implementation</th><td><p>During audits and&nbsp;" + LINK + "Management reviews</a>, improvements "
    "can be identified.</p></td></tr>"
    "</tbody></table>"
)

# "Check details": bare text and a bare link straight in the cells.
CHECK_DETAILS = (
    '<table class="wrapped"><tbody>'
    "<tr><th>Owner</th><td>" + LINK + "Security officer</a></td></tr>"
    "<tr><th>Frequency</th><td>Year</td></tr>"
    "<tr><th>Instruction</th><td>Is the&nbsp;" + LINK + "Monitoring plan</a> executed according to plan?</td></tr>"
    "</tbody></table>"
)

# "Objectives": a header row, explicit widths far wider than the page.
OBJECTIVES = (
    '<table class="wrapped relative-table" style="width: 88.3153%;"><tbody><tr>'
    '<th colwidth="918">Objective</th><th colspan="1" colwidth="241">KPI</th><th colwidth="96">Deadline</th>'
    '<th colspan="1" colwidth="114">Owner</th><th colwidth="110">Status</th></tr>'
    '<tr><td colspan="1" colwidth="918">Prove to our customers</td><td colwidth="241"><p>99%</p></td>'
    '<td colwidth="96">2026</td><td colwidth="114">CEO</td><td colwidth="110">'
    '<span data-background-color="green">Done</span></td></tr>'
    "</tbody></table>"
)

# "Suppliers - Outsourced services": eight columns Confluence sized to 1423px.
SUPPLIERS = (
    "<table><tbody><tr>"
    + "".join(
        f'<th colwidth="{width}"><p><strong>{name}</strong></p></th>'
        for name, width in (
            ("Supplier", 102),
            ("PII (sub)processor", 136),
            ("QAA", 79),
            ("DPA / NDA", 176),
            ("Date", 87),
            ("KPIs", 271),
            ("KPIs last reviewed", 253),
            ("KPI findings", 319),
        )
    )
    + "</tr></tbody></table>"
)


def _soup(html):
    return BeautifulSoup(html, "html.parser")


def _cells(html):
    return _soup(html).find_all(["td", "th"])


@pytest.mark.unit
class TestCellContent:
    def test_content_wrapper_is_unwrapped_and_its_paragraphs_kept(self):
        html = normalise_tables_html(CONTROL_DETAILS)

        assert "content-wrapper" not in html
        requirement = _cells(html)[1]
        assert [child.name for child in requirement.children] == ["p"]
        assert "continually improve the suitability" in requirement.get_text()

    def test_bare_text_goes_into_a_paragraph(self):
        cells = _cells(normalise_tables_html(CHECK_DETAILS))

        assert str(cells[3]) == "<td><p>Year</p></td>"
        assert [child.name for child in cells[0].children] == ["p"]
        assert [child.name for child in cells[1].children] == ["p"]

    def test_inline_runs_between_blocks_each_get_a_paragraph(self):
        html = normalise_tables_html("<table><tr><td>before<ul><li>item</li></ul>after <b>bold</b></td></tr></table>")

        assert "<td><p>before</p><ul><li>item</li></ul><p>after <b>bold</b></p></td>" in html

    def test_an_empty_cell_gets_an_empty_paragraph(self):
        assert "<td><p></p></td>" in normalise_tables_html("<table><tr><th>K</th><td> </td></tr></table>")

    def test_a_block_component_is_left_as_a_block(self):
        html = normalise_tables_html(
            '<table><tr><td><query-block-component kind="tree"></query-block-component></td></tr></table>'
        )

        assert '<td><query-block-component kind="tree"></query-block-component></td>' in html

    def test_no_text_is_lost(self):
        for html in (CONTROL_DETAILS, CHECK_DETAILS, OBJECTIVES):
            before = [" ".join(cell.get_text().split()) for cell in _cells(html)]
            after = [" ".join(cell.get_text().split()) for cell in _cells(normalise_tables_html(html))]
            assert before == after


@pytest.mark.unit
class TestAttributes:
    def test_confluence_presentation_is_dropped(self):
        html = normalise_tables_html(CONTROL_DETAILS + OBJECTIVES)

        for leftover in ('class="wrapped"', "highlight-yellow", "relative-table", 'colspan="1"', "width: 88"):
            assert leftover not in html

    def test_background_and_header_cells_are_kept(self):
        cells = _cells(normalise_tables_html(CONTROL_DETAILS))

        assert [cell.name for cell in cells] == ["th", "td", "th", "td", "th", "td"]
        assert cells[1]["background"] == "var(--editor-colors-orange-background)"

    def test_a_real_span_is_kept(self):
        html = normalise_tables_html('<table><tr><td colspan="2" rowspan="1">x</td></tr></table>')

        assert '<td colspan="2"><p>x</p></td>' in html

    def test_other_classes_survive(self):
        assert 'class="mine"' in normalise_tables_html('<table class="wrapped mine"><tr><td>x</td></tr></table>')


@pytest.mark.unit
class TestWidths:
    def test_a_key_value_table_gets_a_narrow_label_column(self):
        cells = _cells(normalise_tables_html(CHECK_DETAILS))

        assert [cell.get("colwidth") for cell in cells] == [str(KEY_COLUMN_WIDTH), None] * 3

    def test_a_header_row_table_is_not_a_key_value_table(self):
        html = normalise_tables_html("<table><tr><th>A</th><th>B</th></tr><tr><th>a</th><td>b</td></tr></table>")

        assert "colwidth" not in html

    def test_a_single_row_is_not_a_key_value_table(self):
        assert "colwidth" not in normalise_tables_html("<table><tr><th>A</th><td>B</td></tr></table>")

    def test_widths_wider_than_the_page_are_dropped(self):
        """A fixed 1423px table in a 720px column scrolls with every column narrow."""
        assert "colwidth" not in normalise_tables_html(OBJECTIVES)
        assert "colwidth" not in normalise_tables_html(SUPPLIERS)

    def test_a_too_wide_key_value_table_still_gets_its_label_column(self):
        html = normalise_tables_html(
            '<table><tr><th colwidth="400">K</th><td colwidth="900">v</td></tr>'
            '<tr><th colwidth="400">K</th><td colwidth="900">v</td></tr></table>'
        )

        assert [cell.get("colwidth") for cell in _cells(html)] == [str(KEY_COLUMN_WIDTH), None] * 2

    def test_widths_that_fit_are_kept(self):
        html = '<table><tr><th colwidth="200">A</th><td colwidth="400">B</td></tr></table>'

        assert [cell["colwidth"] for cell in _cells(normalise_tables_html(html))] == ["200", "400"]

    def test_the_old_editor_default_width_is_dropped(self):
        html = normalise_tables_html(
            '<table><tr><td colwidth="150">a</td><td colwidth="150">b</td></tr>'
            '<tr><td colwidth="150">c</td><td colwidth="150">d</td></tr></table>'
        )

        assert "colwidth" not in html

    def test_a_deliberate_width_of_150_among_others_is_kept(self):
        html = normalise_tables_html('<table><tr><td colwidth="150">a</td><td colwidth="300">b</td></tr></table>')

        assert 'colwidth="150"' in html


@pytest.mark.unit
class TestShape:
    def test_is_idempotent(self):
        for html in (CONTROL_DETAILS, CHECK_DETAILS, OBJECTIVES):
            once = normalise_tables_html(html)
            assert normalise_tables_html(once) == once

    def test_html_without_a_table_is_returned_untouched(self):
        html = "<p>a&nbsp;b<br></p>"

        assert normalise_tables_html(html) is html

    def test_a_nested_table_is_normalised_too(self):
        html = normalise_tables_html(
            '<table><tr><td><table class="wrapped"><tr><td>in</td></tr></table></td></tr></table>'
        )

        assert "wrapped" not in html
        assert "<td><p>in</p></td>" in html
