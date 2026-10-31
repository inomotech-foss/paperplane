# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The work item detail loads its reactions from the list, so the list is readable wherever the detail is."""

import pytest
from django.utils import timezone

from plane.db.models import Issue, IssueReaction, Project, ProjectMember
from plane.utils.issue_type import link_starter_type

URL = "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/reactions/"


@pytest.fixture
def issue(workspace, create_user):
    project = Project.objects.create(name="P", identifier="P", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    issue = Issue.objects.create(name="I", project=project, workspace=workspace, type=link_starter_type(project))
    IssueReaction.objects.create(
        issue=issue, project=project, workspace=workspace, actor=create_user, reaction="128077"
    )
    return issue


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("archive", ["issue", "project"])
def test_reactions_stay_readable_when_archived(session_client, workspace, issue, archive):
    target = issue if archive == "issue" else issue.project
    target.archived_at = timezone.now()
    target.save(update_fields=["archived_at"])
    url = URL.format(slug=workspace.slug, project_id=issue.project_id, issue_id=issue.id)

    detail = session_client.get(url.replace("reactions/", ""))
    response = session_client.get(url)

    assert detail.status_code == 200
    assert response.status_code == 200
    assert [reaction["reaction"] for reaction in response.json()] == ["128077"]
