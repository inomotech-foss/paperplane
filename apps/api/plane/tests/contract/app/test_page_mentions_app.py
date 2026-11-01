# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from rest_framework import status

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember


def mention(entity_name, entity_identifier):
    return (
        f'<mention-component id="{uuid.uuid4()}" entity_name="{entity_name}" '
        f'entity_identifier="{entity_identifier}"></mention-component>'
    )


@pytest.mark.contract
@pytest.mark.django_db
def test_page_mentions_lists_mentioned_workspace_members(session_client, workspace, create_user):
    project = Project.objects.create(name="P", identifier="PM", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    member = User.objects.create(email="member@example.com", username="member", display_name="Member")
    WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
    outsider = User.objects.create(email="outsider@example.com", username="outsider", display_name="Outsider")
    page = Page.objects.create(
        name="Page",
        description_html="<p>"
        + mention("user_mention", member.id)
        + mention("user_mention", outsider.id)
        + mention("user_mention", "not-a-uuid")
        + mention("issue_mention", create_user.id)
        + "</p>",
        workspace=workspace,
        owned_by=create_user,
        access=Page.PUBLIC_ACCESS,
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=page, created_by=create_user)

    response = session_client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/mentions/")

    assert response.status_code == status.HTTP_200_OK
    assert [(row["id"], row["display_name"]) for row in response.json()] == [(str(member.id), "Member")]
    assert "avatar_url" in response.json()[0]
