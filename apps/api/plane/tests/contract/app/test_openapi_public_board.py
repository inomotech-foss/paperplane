# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The public board reaction, vote and comment endpoints return what the OpenAPI schema documents."""

import pytest

from plane.db.models import (
    DeployBoard,
    Issue,
    IssueReaction,
    IssueVote,
    ProjectMember,
    State,
)
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.utils.issue_type import link_starter_type

ISSUE = "/api/public/anchor/{anchor}/issues/{issue_id}/"


@pytest.fixture
def board(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="PB")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    issue = Issue.objects.create(
        name="a", project=project, workspace=workspace, state=state, type=link_starter_type(project)
    )
    deploy_board = DeployBoard.objects.create(
        workspace=workspace,
        project=project,
        entity_name="project",
        entity_identifier=project.id,
        is_comments_enabled=True,
        is_reactions_enabled=True,
        is_votes_enabled=True,
    )
    return {"board": deploy_board, "issue": issue, "project": project}


def issue_url(board, path=""):
    return ISSUE.format(anchor=board["board"].anchor, issue_id=board["issue"].id) + path


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestPublicBoard:
    def test_reactions_list(self, session_client, create_user, workspace, board):
        IssueReaction.objects.create(
            issue=board["issue"], project=board["project"], workspace=workspace, actor=create_user, reaction="128077"
        )
        rows = documented(session_client.get(issue_url(board, "reactions/")))
        assert [row["reaction"] for row in rows] == ["128077"]

    def test_votes_list(self, session_client, create_user, workspace, board):
        IssueVote.objects.create(
            issue=board["issue"], project=board["project"], workspace=workspace, actor=create_user, vote=-1
        )
        rows = documented(session_client.get(issue_url(board, "votes/")))
        assert [row["vote"] for row in rows] == [-1]
