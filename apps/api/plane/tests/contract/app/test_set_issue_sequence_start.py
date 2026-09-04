# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import Issue, IssueSequence, Project, State


@pytest.fixture
def project(workspace):
    project = Project.objects.create(workspace=workspace, name="Sales Funnel", identifier="ISFUN")
    State.objects.create(workspace=workspace, project=project, name="Backlog", color="#000000", default=True)
    return project


def create_issue(project, name):
    return Issue.objects.create(workspace=project.workspace, project=project, name=name)


@pytest.mark.contract
@pytest.mark.django_db
class TestSetIssueSequenceStart:
    def run(self, **overrides):
        output = StringIO()
        options = {"workspace": "test-workspace", "project": "ISFUN", "start": 5000, **overrides}
        call_command("set_issue_sequence_start", stdout=output, **options)
        return output.getvalue()

    def test_next_issue_receives_the_start_number(self, project):
        first = create_issue(project, "First")
        second = create_issue(project, "Second")
        assert (first.sequence_id, second.sequence_id) == (1, 2)

        output = self.run(start=5000)

        assert "ISFUN-5000" in output
        third = create_issue(project, "Third")
        fourth = create_issue(project, "Fourth")
        assert (third.sequence_id, fourth.sequence_id) == (5000, 5001)

    def test_existing_issues_keep_their_numbers(self, project):
        first = create_issue(project, "First")

        self.run(start=5000)

        first.refresh_from_db()
        assert first.sequence_id == 1
        assert IssueSequence.objects.get(issue=first).sequence == 1

    def test_placeholder_is_not_attached_to_an_issue(self, project):
        self.run(start=5000)

        placeholder = IssueSequence.objects.get(project=project, sequence=4999)
        assert placeholder.issue is None
        assert placeholder.workspace == project.workspace

    def test_matches_the_identifier_case_insensitively(self, project):
        self.run(project="isfun", start=5000)

        assert create_issue(project, "Next").sequence_id == 5000

    def test_errors_when_start_is_not_above_the_current_maximum(self, project):
        create_issue(project, "First")
        create_issue(project, "Second")

        with pytest.raises(CommandError, match="greater than 2"):
            self.run(start=2)

        assert not IssueSequence.objects.filter(project=project, issue__isnull=True).exists()
        assert create_issue(project, "Third").sequence_id == 3

    def test_errors_when_start_is_below_two(self, project):
        with pytest.raises(CommandError, match="at least 2"):
            self.run(start=1)

    def test_errors_on_an_unknown_project(self, project):
        with pytest.raises(CommandError, match="No project"):
            self.run(project="NOPE")

    def test_errors_on_an_unknown_workspace(self, project):
        with pytest.raises(CommandError, match="No project"):
            self.run(workspace="other-workspace")
