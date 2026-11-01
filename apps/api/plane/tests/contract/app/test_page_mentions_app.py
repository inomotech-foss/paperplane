# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember


def mention(entity_name, entity_identifier):
    return (
        f'<mention-component id="{uuid.uuid4()}" entity_name="{entity_name}" '
        f'entity_identifier="{entity_identifier}"></mention-component>'
    )


def make_user(name):
    return User.objects.create(email=f"{name}@example.com", username=name, display_name=name.title())


def make_page(workspace, project, owner, html="<p></p>", access=Page.PUBLIC_ACCESS):
    page = Page.objects.create(name="Page", description_html=html, workspace=workspace, owned_by=owner, access=access)
    ProjectPage.objects.create(workspace=workspace, project=project, page=page, created_by=owner)
    return page


def url(workspace, project, page):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/mentions/"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="P", identifier="PM", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.mark.contract
@pytest.mark.django_db
class TestPageMentions:
    def test_lists_mentioned_active_workspace_members(self, session_client, workspace, project, create_user):
        member = make_user("member")
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
        inactive = make_user("inactive")
        WorkspaceMember.objects.create(workspace=workspace, member=inactive, role=15, is_active=False)
        removed = make_user("removed")
        WorkspaceMember.objects.create(workspace=workspace, member=removed, role=15, deleted_at=timezone.now())
        outsider = make_user("outsider")
        html = "".join(
            [
                mention("user_mention", member.id),
                mention("user_mention", inactive.id),
                mention("user_mention", removed.id),
                mention("user_mention", outsider.id),
                mention("user_mention", "not-a-uuid"),
                mention("issue_mention", create_user.id),
            ]
        )
        page = make_page(workspace, project, create_user, f"<p>{html}</p>")

        response = session_client.get(url(workspace, project, page))

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == [{"id": str(member.id), "display_name": "Member", "avatar_url": None}]

    def test_private_page_of_someone_else(self, session_client, workspace, project, create_user):
        owner = make_user("owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15)
        ProjectMember.objects.create(project=project, member=owner, role=15, is_active=True)
        page = make_page(workspace, project, owner, access=Page.PRIVATE_ACCESS)

        assert session_client.get(url(workspace, project, page)).status_code == status.HTTP_403_FORBIDDEN

    def test_non_project_member(self, api_client, workspace, project, create_user):
        stranger = make_user("stranger")
        WorkspaceMember.objects.create(workspace=workspace, member=stranger, role=15)
        page = make_page(workspace, project, create_user)
        api_client.force_authenticate(user=stranger)

        assert api_client.get(url(workspace, project, page)).status_code == status.HTTP_403_FORBIDDEN

    def test_guest_without_guest_view_all_features(self, api_client, workspace, project, create_user):
        guest = make_user("guest")
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
        ProjectMember.objects.create(project=project, member=guest, role=5, is_active=True)
        page = make_page(workspace, project, create_user)
        api_client.force_authenticate(user=guest)

        assert api_client.get(url(workspace, project, page)).status_code == status.HTTP_403_FORBIDDEN
