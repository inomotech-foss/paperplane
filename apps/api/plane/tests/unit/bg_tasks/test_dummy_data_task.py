# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.bgtasks.dummy_data_task import create_intake_issues, create_project, create_states
from plane.db.models import Issue, IntakeIssue, StateGroup, Workspace


@pytest.mark.unit
@pytest.mark.django_db
def test_intake_items_use_the_triage_state_until_accepted(create_user):
    workspace = Workspace.objects.create(name="Dummy", slug="dummy", owner=create_user)
    project = create_project(workspace=workspace, user_id=create_user.id)
    create_states(workspace=workspace, project=project, user_id=create_user.id)

    create_intake_issues(workspace=workspace, project=project, user_id=create_user.id, intake_issue_count=30)

    intake_issues = IntakeIssue.objects.filter(project=project).select_related("issue__state")
    assert intake_issues.count() == 30
    for intake_issue in intake_issues:
        state = intake_issue.issue.state
        if intake_issue.status == 1:
            assert state.default
        else:
            assert state.group == StateGroup.TRIAGE.value

    pending = intake_issues.exclude(status=1).values_list("issue_id", flat=True)
    assert not Issue.issue_objects.filter(id__in=pending).exists()
