# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.jira.backup import JiraIssue
from plane.importers.jira.states import in_workflow_order, state_for


def issue(status, category, resolution=""):
    return JiraIssue(key="DEMO-1", summary="", status=status, status_category=category, resolution=resolution)


@pytest.mark.unit
class TestStatusMapping:
    @pytest.mark.parametrize(
        ("category", "group"),
        [
            ("undefined", "backlog"),
            ("No Category", "backlog"),
            ("new", "unstarted"),
            ("indeterminate", "started"),
            ("done", "completed"),
        ],
    )
    def test_every_status_category_lands_in_a_group(self, category, group):
        assert state_for(issue("Some Status", category)) == ("Some Status", group)

    def test_an_unknown_category_falls_back_to_the_backlog(self):
        assert state_for(issue("Parked", "something-new")) == ("Parked", "backlog")

    def test_a_missing_status_gets_a_name(self):
        assert state_for(issue("", "undefined")) == ("Backlog", "backlog")

    def test_a_delivered_issue_is_completed(self):
        assert state_for(issue("Done", "done", "Fixed")) == ("Done", "completed")

    def test_a_cancelling_resolution_moves_the_issue_out_of_done(self):
        """A fixed issue and a dropped one share the Done category and often
        the same status, so only the resolution says which happened."""
        assert state_for(issue("Done", "done", "Won't Do")) == ("Cancelled", "cancelled")

    def test_a_status_that_names_itself_cancelled_keeps_its_name(self):
        assert state_for(issue("Rejected", "done")) == ("Rejected", "cancelled")

    def test_a_cancelling_resolution_outside_done_does_not_move_the_issue(self):
        assert state_for(issue("In Review", "indeterminate", "Won't Do")) == ("In Review", "started")


@pytest.mark.unit
class TestWorkflowOrder:
    def test_states_are_created_backlog_first_and_cancelled_last(self):
        statuses = {"Done": "completed", "Triaging": "backlog", "Building": "started", "Dropped": "cancelled"}

        assert [name for name, _ in in_workflow_order(statuses)] == ["Triaging", "Building", "Done", "Dropped"]
