# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.confluence import ConversionResult, storage_to_html
from plane.importers.confluence.resolvers import ResolvedAttachment, ResolvedPage, ResolvedUser, Resolvers

DETAILS = """
<ac:structured-macro ac:name="details"><ac:rich-text-body>
  <table><tbody>
    <tr><th><p>Owner</p></th><td><p>Team A</p></td></tr>
    <tr><th><p>Status</p></th><td><p>Approved</p></td></tr>
  </tbody></table>
</ac:rich-text-body></ac:structured-macro>
"""

TASKS = """
<ac:task-list>
  <ac:task><ac:task-status>complete</ac:task-status>
    <ac:task-body>Ship the thing</ac:task-body></ac:task>
  <ac:task><ac:task-status>incomplete</ac:task-status>
    <ac:task-body>Review the draft
      <ac:link><ri:user ri:account-id="acc-1"/></ac:link>
      <time datetime="2026-03-04"/></ac:task-body></ac:task>
</ac:task-list>
"""

DECISIONS = """
<ac:adf-extension><ac:adf-node type="decision-list">
  <ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute>
    <ac:adf-content>Use the boring option</ac:adf-content></ac:adf-node>
</ac:adf-node></ac:adf-extension>
"""


def _entries(body, kind, resolvers=None):
    result = storage_to_html(body, resolvers, ConversionResult(html=""))
    return [entry for entry in result.index_entries if entry.kind == kind]


def _property_row(value):
    return (
        '<ac:structured-macro ac:name="details"><ac:rich-text-body><table><tbody>'
        f"<tr><th><p>Field</p></th><td>{value}</td></tr>"
        "</tbody></table></ac:rich-text-body></ac:structured-macro>"
    )


def _indexed_value(value, resolvers=None):
    return _entries(_property_row(value), "property", resolvers)[0].value


@pytest.mark.unit
class TestPageIndexing:
    """The query blocks aggregate these across pages, so anything the index
    misses is invisible to them however well the page itself renders."""

    def test_details_rows_become_key_value_properties(self):
        entries = _entries(DETAILS, "property")

        assert [(entry.key, entry.value) for entry in entries] == [("Owner", "Team A"), ("Status", "Approved")]
        assert [entry.order for entry in entries] == [0, 1]

    def test_a_details_table_still_renders_as_a_table(self):
        """Indexing reads the macro; it must not consume it."""
        result = storage_to_html(DETAILS, None, ConversionResult(html=""))

        assert "<table>" in result.html
        assert "Approved" in result.html

    def test_a_row_without_a_value_column_is_not_indexed(self):
        entries = _entries(
            '<ac:structured-macro ac:name="details"><ac:rich-text-body>'
            "<table><tbody><tr><td><p>Lonely</p></td></tr></tbody></table>"
            "</ac:rich-text-body></ac:structured-macro>",
            "property",
        )

        assert entries == []

    def test_a_third_column_is_recorded_as_a_downgrade(self):
        body = (
            '<ac:structured-macro ac:name="details"><ac:rich-text-body><table><tbody>'
            "<tr><th><p>Owner</p></th><td><p>Team A</p></td><td><p>extra</p></td></tr>"
            "</tbody></table></ac:rich-text-body></ac:structured-macro>"
        )

        result = storage_to_html(body, None, ConversionResult(html=""))

        assert result.downgraded["details"] == 1
        assert [(entry.key, entry.value) for entry in result.index_entries] == [("Owner", "Team A")]
        # The cell is only unindexable, not lost: it still renders.
        assert "extra" in result.html

    def test_a_status_macro_indexes_its_title_and_not_its_colour(self):
        """The colour is how the lozenge is drawn, never part of the value."""
        value = '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter>'
        value += '<ac:parameter ac:name="title">yes</ac:parameter></ac:structured-macro>'

        assert _indexed_value(value) == "yes"

    def test_a_jira_macro_indexes_its_key(self):
        value = '<ac:structured-macro ac:name="jira"><ac:parameter ac:name="server">System Jira</ac:parameter>'
        value += '<ac:parameter ac:name="key">ABC-1</ac:parameter></ac:structured-macro>'

        assert _indexed_value(value) == "ABC-1"

    def test_a_macro_body_is_still_indexed(self):
        value = '<ac:structured-macro ac:name="tip"><ac:parameter ac:name="icon">false</ac:parameter>'
        value += "<ac:rich-text-body><p>Do the thing</p></ac:rich-text-body></ac:structured-macro>"

        assert _indexed_value(value) == "Do the thing"

    def test_an_include_macro_indexes_the_page_it_references(self):
        value = (
            '<ac:structured-macro ac:name="include"><ac:parameter ac:name="">'
            '<ac:link><ri:page ri:content-title="Shared intro"/></ac:link>'
            "</ac:parameter></ac:structured-macro>"
        )

        assert _indexed_value(value) == "Shared intro"

    def test_a_mention_indexes_the_name_it_renders_as(self):
        resolvers = Resolvers(users={"acct-1": ResolvedUser(id="u1", display_name="Ada Lovelace")})
        value = '<ac:link><ri:user ri:account-id="acct-1"/></ac:link>'

        assert _indexed_value(value, resolvers) == "Ada Lovelace"

    def test_a_page_link_indexes_its_title(self):
        resolvers = Resolvers(pages={"Security policy": ResolvedPage(id="p1", url="/p/1/", title="Security policy")})
        value = '<ac:link><ri:page ri:content-title="Security policy"/></ac:link>'

        assert _indexed_value(value, resolvers) == "Security policy"

    def test_an_unresolved_page_link_still_indexes_its_title(self):
        value = '<ac:link><ri:page ri:content-title="Missing page"/></ac:link>'

        assert _indexed_value(value) == "Missing page"

    def test_a_link_label_wins_over_the_target_title(self):
        value = (
            '<ac:link><ri:page ri:content-title="Security policy"/>'
            "<ac:plain-text-link-body>the policy</ac:plain-text-link-body></ac:link>"
        )

        assert _indexed_value(value) == "the policy"

    def test_an_attachment_link_indexes_its_filename(self):
        attachment = ResolvedAttachment(id="a1", filename="spec.pdf", is_image=False, url="/assets/spec.pdf")
        resolvers = Resolvers(attachments={"spec.pdf": attachment})
        value = '<ac:link><ri:attachment ri:filename="spec.pdf"/></ac:link>'

        assert _indexed_value(value, resolvers) == "spec.pdf"

    def test_a_date_indexes_as_the_day_it_shows(self):
        assert _indexed_value('<time datetime="2026-03-04"/>') == "2026-03-04"

    def test_indexing_a_value_leaves_the_page_untouched(self):
        """The index reads a copy: the passes still need the real markup."""
        value = '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Red</ac:parameter>'
        value += '<ac:parameter ac:name="title">no</ac:parameter></ac:structured-macro>'
        resolvers = Resolvers(users={"acct-1": ResolvedUser(id="u1", display_name="Ada Lovelace")})
        body = _property_row(value + '<ac:link><ri:user ri:account-id="acct-1"/></ac:link>')

        result = storage_to_html(body, resolvers, ConversionResult(html=""))

        assert "mention-component" in result.html
        assert "no" in result.html

    def test_tasks_carry_their_status_assignee_and_due_date(self):
        entries = _entries(TASKS, "task")

        assert [entry.is_complete for entry in entries] == [True, False]
        assert entries[0].value == "Ship the thing"
        assert entries[0].account_id == ""
        assert entries[1].account_id == "acc-1"
        assert entries[1].due_date == "2026-03-04"

    def test_tasks_are_still_converted_to_checkboxes(self):
        result = storage_to_html(TASKS, None, ConversionResult(html=""))

        assert 'data-type="taskList"' in result.html
        assert result.html.count('data-type="taskItem"') == 2

    def test_decisions_are_indexed_as_taken(self):
        entries = _entries(DECISIONS, "decision")

        assert [(entry.value, entry.is_complete) for entry in entries] == [("Use the boring option", True)]

    def test_an_empty_page_indexes_nothing(self):
        result = storage_to_html("<p>Just prose</p>", None, ConversionResult(html=""))

        assert result.index_entries == []

    def test_indexing_does_not_count_as_loss(self):
        simple_task = (
            "<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status>"
            "<ac:task-body>Review the draft</ac:task-body></ac:task></ac:task-list>"
        )

        result = storage_to_html(DETAILS + simple_task + DECISIONS, None, ConversionResult(html=""))

        assert len(result.index_entries) == 4
        assert result.is_lossless
