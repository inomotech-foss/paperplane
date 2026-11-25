# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from bs4 import BeautifulSoup

from plane.importers.confluence.includes import convert_include_links
from plane.importers.confluence.repair import repair_page_html

PROJECT = "11111111-1111-4111-8111-111111111111"
SNIPPET = "22222222-2222-4222-8222-222222222222"
OTHER = "33333333-3333-4333-8333-333333333333"


def _link(page_id, text="snippet.check.highlevel"):
    return f'<a href="/inomo/projects/{PROJECT}/pages/{page_id}/" rel="noopener noreferrer nofollow">{text}</a>'


INCLUDE = f'<query-block-component kind="include" root-page-id="{SNIPPET}"></query-block-component>'


@pytest.mark.unit
class TestIncludeLinks:
    def test_a_snippet_link_alone_in_a_paragraph_becomes_an_include(self):
        result = repair_page_html(f"<p>{_link(SNIPPET)}</p><p>after</p>", {SNIPPET})

        assert result.html == f"{INCLUDE}<p>after</p>"
        assert result.includes == [SNIPPET]

    def test_a_link_to_any_other_page_stays_a_link(self):
        html = f"<p>{_link(OTHER)}</p>"

        assert repair_page_html(html, {SNIPPET}).html == html

    def test_a_snippet_link_among_text_stays_a_link(self):
        html = f"<p>See {_link(SNIPPET)} first.</p>"

        assert repair_page_html(html, {SNIPPET}).includes == []

    def test_a_snippet_link_inside_formatting_stays_a_link(self):
        assert repair_page_html(f"<p><strong>{_link(SNIPPET)}</strong></p>", {SNIPPET}).includes == []

    def test_a_snippet_link_in_a_list_item_stays_a_link(self):
        assert repair_page_html(f"<ul><li>{_link(SNIPPET)}</li></ul>", {SNIPPET}).includes == []

    def test_the_only_content_of_a_table_cell_becomes_an_include(self):
        """ "Check details" rows hold the include straight in the cell, the
        content-wrapper variant in a paragraph inside it."""
        for cell in (_link(SNIPPET), f'<div class="content-wrapper"><p>{_link(SNIPPET)}</p></div>'):
            rows = f"<tr><th>Instruction</th><td>{cell}</td></tr><tr><th>Owner</th><td>x</td></tr>"
            html = f"<table><tbody>{rows}</tbody></table>"

            result = repair_page_html(html, {SNIPPET})

            assert f"<td>{INCLUDE}</td>" in result.html
            assert result.includes == [SNIPPET]

    def test_a_snippet_link_as_a_column_title_stays_a_link(self):
        """The Objectives tables title a column with a link to the KPI snippet."""
        html = f"<table><tbody><tr><th>Objective</th><th>{_link(SNIPPET, 'KPI')}</th></tr></tbody></table>"

        result = repair_page_html(html, {SNIPPET})

        assert result.includes == []
        assert "KPI</a></p></th>" in result.html

    def test_a_link_with_a_fragment_or_elsewhere_is_not_matched(self):
        html = f'<p><a href="/inomo/projects/{PROJECT}/pages/{SNIPPET}/#part">x</a></p>'

        assert repair_page_html(html, {SNIPPET}).includes == []

    def test_no_snippets_means_no_includes(self):
        html = f"<p>{_link(SNIPPET)}</p>"

        assert repair_page_html(html, set()).html == html

    def test_converting_twice_changes_nothing_more(self):
        once = repair_page_html(f"<p>{_link(SNIPPET)}</p>", {SNIPPET}).html

        assert repair_page_html(once, {SNIPPET}).includes == []


@pytest.mark.unit
class TestRepair:
    def test_a_page_without_tables_or_snippet_links_is_returned_as_is(self):
        html = "<p>a&nbsp;b</p>"

        result = repair_page_html(html, {SNIPPET})

        assert result.html is html
        assert not result.has_tables

    def test_counts_the_tables(self):
        result = repair_page_html("<table><tr><td>a</td></tr></table><table><tr><td>b</td></tr></table>")

        assert result.tables == 2
        assert result.has_tables

    def test_empty_html(self):
        assert repair_page_html("", {SNIPPET}).html == ""


@pytest.mark.unit
def test_convert_include_links_reports_each_block():
    soup = BeautifulSoup(f"<p>{_link(SNIPPET)}</p><p>{_link(SNIPPET)}</p>", "html.parser")

    assert convert_include_links(soup, [SNIPPET]) == [SNIPPET, SNIPPET]
