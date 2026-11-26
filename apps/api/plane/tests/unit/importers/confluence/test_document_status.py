# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The Confluence "Document status" table, read from snippets of real imported pages."""

from datetime import date

import pytest

from plane.importers.confluence.document_status import (
    MENTIONED_USER,
    LegacyApproval,
    parse_date,
    parse_document_status,
)
from plane.importers.confluence.repair import repair_page_html

LINK = '<a href="/inomo/projects/p/pages/x/" rel="noopener noreferrer nofollow">{}</a>'

# As imported: header cells, a third column listing the possible statuses
APPROVED = (
    '<p class="auto-cursor-target"><br></p><h1 class="auto-cursor-target">Document status</h1>'
    '<table class="wrapped"><tbody>'
    f'<tr><th colspan="1">Owner</th><td colspan="1">{LINK.format("Change manager")}</td><td colspan="1"><br></td></tr>'
    f'<tr><th colspan="1">Classification</th><td colspan="1">{LINK.format("Internal")}</td>'
    '<td colspan="1"><br></td></tr>'
    '<tr><th>Status</th><td><div class="content-wrapper"><span data-background-color="green">approved</span></div></td>'
    '<td colspan="1"><span data-background-color="gray">draft</span>&nbsp;'
    '<span data-background-color="light-blue">REVIEW</span>&nbsp;</td></tr>'
    '<tr><th>Approved on</th><td>03.11.2025</td><td colspan="1"><br></td></tr>'
    '<tr><th>Approved by</th><td>Roger Knecht</td><td colspan="1"><br></td></tr>'
    "</tbody></table><p>The change management process ...</p>"
)

# Penetration testing policy: ISO date with a trailing space, approver as a user mention
ISO_DATE_MENTION = (
    '<h1 class="auto-cursor-target">Document status</h1><table class="wrapped"><tbody>'
    '<tr><th>Status</th><td><div class="content-wrapper"><p><span data-background-color="green">approved</span></p>'
    '</div></td><td colspan="1"><span data-background-color="light-blue">REVIEW</span> '
    '<span data-background-color="gray">draft</span> &nbsp;'
    '<span data-background-color="green">approved</span></td></tr>'
    '<tr><th>Approved on</th><td>2024-11-27&nbsp;</td><td colspan="1"><br></td></tr>'
    '<tr><th>Approved by</th><td><mention-component entity_identifier="165f89a2-52a5-4a42-b754-0953cfa3dc14" '
    'entity_name="user_mention" id="165f89a2-52a5-4a42-b754-0953cfa3dc14"></mention-component></td>'
    '<td colspan="1"><br></td></tr></tbody></table>'
)

# Statement of Applicability: generated, never approved
AUTO = (
    '<h1 class="auto-cursor-target">Document status</h1><table class="wrapped"><tbody>'
    '<tr><th>Status</th><td><div class="content-wrapper"><span data-background-color="orange">AUTO</span></div></td>'
    '<td colspan="1"><span data-background-color="gray">draft</span>&nbsp;'
    '<span data-background-color="light-blue">REVIEW</span>&nbsp;<span data-background-color="green">approved</span>'
    "</td></tr>"
    '<tr><th>Approved on</th><td><br></td><td colspan="1"><br></td></tr>'
    '<tr><th>Approved by</th><td><br></td><td colspan="1"><br></td></tr></tbody></table>'
)

# An AI agent register entry: a "Status" row, but not a document status
AI_AGENT = (
    "<h2>📋 Compliance &amp; Lifecycle</h2><table><tbody>"
    "<tr><th><p>Field</p></th><th><p>Value</p></th></tr>"
    "<tr><td><p>GPAI / high-risk candidate (EU AI Act)</p></td><td><p>no</p></td></tr>"
    '<tr><td><p>Status</p></td><td><p><span data-background-color="green">Active</span></p></td></tr>'
    "<tr><td><p>Approved on / by</p></td><td><p></p></td></tr>"
    "<tr><td><p>Last review</p></td><td><p>2026-06-18</p></td></tr></tbody></table>"
)

pytestmark = pytest.mark.unit


def test_reads_an_approved_document_status():
    assert parse_document_status(APPROVED) == LegacyApproval(
        status="approved", approved_by="Roger Knecht", approved_at=date(2025, 11, 3), approved_at_raw="03.11.2025"
    )


def test_ignores_the_legend_column():
    legacy = parse_document_status(APPROVED.replace(">approved</span></div>", ">draft</span></div>"))
    assert legacy.status == "draft"
    assert not legacy.is_approved


def test_reads_the_table_after_the_confluence_repair():
    """#441 rewrites the tables (paragraphs in cells, widths); the status still reads the same."""
    repaired = repair_page_html(APPROVED).html
    assert "<p>Roger Knecht</p>" in repaired
    assert parse_document_status(repaired) == parse_document_status(APPROVED)


def test_iso_date_and_a_user_mention_that_is_not_resolved():
    legacy = parse_document_status(ISO_DATE_MENTION)

    assert legacy.approved_at == date(2024, 11, 27)
    assert legacy.approved_at_raw == "2024-11-27"
    # the mention names a Paperplane user, deliberately not looked up
    assert legacy.approved_by == MENTIONED_USER
    assert "165f89a2" not in legacy.approved_by


def test_a_status_without_approval():
    assert parse_document_status(AUTO) == LegacyApproval(status="AUTO")


def test_other_tables_with_a_status_row_are_not_a_document_status():
    assert parse_document_status(AI_AGENT) is None


def test_a_status_row_counts_under_a_document_status_heading():
    html = "<h2>Document status</h2><table><tr><td>Status</td><td>REVIEW</td></tr></table>"
    assert parse_document_status(html) == LegacyApproval(status="REVIEW")


def test_pages_without_a_table_or_with_an_empty_one():
    assert parse_document_status("") is None
    assert parse_document_status(None) is None
    assert parse_document_status("<p>Below is the plan for the internal audits.</p>") is None
    empty = AUTO.replace(">AUTO<", "><")
    assert parse_document_status(empty) is None


def test_finds_the_status_table_after_other_tables():
    html = "<table><tr><th>Topic</th><td>Year 1</td></tr></table>" + APPROVED
    assert parse_document_status(html).approved_by == "Roger Knecht"


def test_german_labels():
    html = (
        "<table><tr><th>Dokumentstatus</th><td>freigegeben</td></tr>"
        "<tr><th>Freigegeben von:</th><td>Frank Wagner</td></tr>"
        "<tr><th>Freigabedatum</th><td>5.12.25</td></tr></table>"
    )
    legacy = parse_document_status(html)
    assert (legacy.status, legacy.approved_by, legacy.approved_at) == ("freigegeben", "Frank Wagner", date(2025, 12, 5))
    assert legacy.is_approved


def test_an_unreadable_date_is_kept_as_written():
    legacy = parse_document_status(APPROVED.replace("03.11.2025", "after the Q4 review"))
    assert legacy.approved_at is None
    assert legacy.approved_at_raw == "after the Q4 review"


def test_a_confluence_date_macro():
    legacy = parse_document_status(APPROVED.replace("03.11.2025", '<time datetime="2025-11-03"></time>'))
    assert legacy.approved_at == date(2025, 11, 3)


def test_placeholders_count_as_empty():
    legacy = parse_document_status(APPROVED.replace("Roger Knecht", "–"))
    assert legacy.approved_by == ""


def test_broken_html_does_not_raise():
    for html in ("<table><tr><th>Approved by<td>Roger", "<table><<<>>></table", "<table>" * 50):
        assert parse_document_status(html) is None or isinstance(parse_document_status(html), LegacyApproval)


@pytest.mark.parametrize(
    "text, expected",
    [
        ("03.11.2025", date(2025, 11, 3)),
        ("3.11.2025", date(2025, 11, 3)),
        ("03/11/2025", date(2025, 11, 3)),
        ("03.11.25", date(2025, 11, 3)),
        ("2024-09-24", date(2024, 9, 24)),
        ("3 Nov 2025", date(2025, 11, 3)),
        ("November 3, 2025", date(2025, 11, 3)),
        ("31.02.2025", None),
        ("", None),
        ("soon", None),
    ],
)
def test_parse_date(text, expected):
    assert parse_date(text) == expected
