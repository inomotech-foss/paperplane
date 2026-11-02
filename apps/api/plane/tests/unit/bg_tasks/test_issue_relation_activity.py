# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest
from django.utils import timezone

from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, IssueActivity, Project, ProjectMember
from plane.utils.issue_type import link_starter_type

pytestmark = pytest.mark.unit


@pytest.fixture
def issues(db, workspace, create_user):
    project = Project.objects.create(name="Home", identifier="HOME", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    first, second = (
        Issue.objects.create(name=name, project=project, workspace=workspace, type=link_starter_type(project))
        for name in ("First", "Second")
    )
    return first, second


def _run(type, requested_data, issue):
    issue_activity(
        type=type,
        requested_data=json.dumps(requested_data),
        current_instance=json.dumps({}),
        issue_id=str(issue.id),
        actor_id=str(issue.project.created_by_id),
        project_id=str(issue.project_id),
        epoch=int(timezone.now().timestamp()),
    )


@pytest.mark.parametrize(
    "relation_type,inverse",
    [
        ("start_before", "start_after"),
        ("finish_after", "finish_before"),
        ("implements", "implemented_by"),
        ("blocked_by", "blocking"),
        ("relates_to", "relates_to"),
    ],
)
def test_removed_relation_records_the_inverse_on_the_related_item(issues, relation_type, inverse):
    first, second = issues
    _run("issue_relation.activity.deleted", {"relation_type": relation_type, "related_issue": str(second.id)}, first)

    own = IssueActivity.objects.get(issue=first, verb="deleted")
    related = IssueActivity.objects.get(issue=second, verb="deleted")
    assert (own.field, own.old_identifier) == (relation_type, second.id)
    assert (related.field, related.comment, related.old_identifier) == (
        inverse,
        f"deleted {inverse} relation",
        first.id,
    )
