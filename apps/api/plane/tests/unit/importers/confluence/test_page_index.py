# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.confluence import ConversionResult, storage_to_html

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


def _entries(body, kind):
    result = storage_to_html(body, None, ConversionResult(html=""))
    return [entry for entry in result.index_entries if entry.kind == kind]


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
