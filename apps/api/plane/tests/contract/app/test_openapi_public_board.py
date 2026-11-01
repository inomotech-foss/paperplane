# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The public board reaction, vote and comment endpoints return what the OpenAPI schema documents."""

import pytest
from django.utils import timezone

from plane.db.models import (
    CommentReaction,
    DeployBoard,
    Issue,
    IssueComment,
    IssueReaction,
    IssueVote,
    ProjectMember,
    State,
)
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_request
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

    def test_vote_body(self, session_client, workspace, board):
        documented_request(ISSUE + "votes/", "post", {"vote": -1})
        documented(session_client.post(issue_url(board, "votes/"), {"vote": -1}, format="json"), 201)
        assert IssueVote.objects.get(issue=board["issue"]).vote == -1

    def test_votes_list(self, session_client, create_user, workspace, board):
        IssueVote.objects.create(
            issue=board["issue"], project=board["project"], workspace=workspace, actor=create_user, vote=-1
        )
        rows = documented(session_client.get(issue_url(board, "votes/")))
        assert [row["vote"] for row in rows] == [-1]

    def test_comment_reactions_carry_the_actor(self, session_client, create_user, workspace, board):
        comment = IssueComment.objects.create(
            issue=board["issue"],
            project=board["project"],
            workspace=workspace,
            actor=create_user,
            access="EXTERNAL",
            comment_html="<p>hi</p>",
        )
        CommentReaction.objects.create(
            comment=comment, project=board["project"], workspace=workspace, actor=create_user, reaction="128077"
        )
        rows = documented(session_client.get(issue_url(board, "comments/")))
        assert rows[0]["comment_reactions"][0]["actor_detail"]["id"] == str(create_user.id)


@pytest.mark.contract
@pytest.mark.django_db
def test_project_boards_route_is_gone(api_client, workspace):
    assert api_client.get(f"/api/public/workspaces/{workspace.slug}/project-boards/").status_code == 404


@pytest.mark.contract
@pytest.mark.django_db
class TestPublicBoardScope:
    """The reactions, votes and comments lists show only what the board shows."""

    @pytest.fixture
    def activity(self, create_user, workspace, board):
        def add(issue):
            IssueReaction.objects.create(
                issue=issue, project=issue.project, workspace=workspace, actor=create_user, reaction="128077"
            )
            IssueVote.objects.create(issue=issue, project=issue.project, workspace=workspace, actor=create_user, vote=1)
            IssueComment.objects.create(
                issue=issue,
                project=issue.project,
                workspace=workspace,
                actor=create_user,
                access="EXTERNAL",
                comment_html="<p>c</p>",
            )

        return add

    @staticmethod
    def lists(client, anchor, issue_id):
        return [
            client.get(ISSUE.format(anchor=anchor, issue_id=issue_id) + path).json()
            for path in ("reactions/", "votes/", "comments/")
        ]

    def test_visible_issue(self, session_client, board, activity):
        activity(board["issue"])
        assert all(self.lists(session_client, board["board"].anchor, board["issue"].id))

    def test_issue_the_board_does_not_show(self, session_client, workspace, board, activity):
        hidden = Issue.objects.create(
            name="archived",
            project=board["project"],
            workspace=workspace,
            state=board["issue"].state,
            type=board["issue"].type,
            archived_at=timezone.now(),
        )
        activity(hidden)
        assert self.lists(session_client, board["board"].anchor, hidden.id) == [[], [], []]

    def test_issue_of_another_board(self, session_client, create_user, workspace, board, activity):
        other = ProjectFactory(workspace=workspace, identifier="OB")
        ProjectMember.objects.create(project=other, member=create_user, role=20)
        issue = Issue.objects.create(name="o", project=other, workspace=workspace, type=link_starter_type(other))
        activity(issue)
        assert self.lists(session_client, board["board"].anchor, issue.id) == [[], [], []]

    def test_disabled_board(self, session_client, board, activity):
        activity(board["issue"])
        DeployBoard.objects.filter(pk=board["board"].pk).update(
            is_comments_enabled=False, is_reactions_enabled=False, is_votes_enabled=False
        )
        assert self.lists(session_client, board["board"].anchor, board["issue"].id) == [[], [], []]
