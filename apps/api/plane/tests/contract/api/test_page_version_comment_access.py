# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""v1 page versions and comments follow the page's access, as in the app API,
and only a comment's author or an admin can change it."""

from uuid import uuid4

import pytest
from rest_framework import status

from plane.db.models import Page, PageComment, PageVersion, Project, ProjectMember, ProjectPage, User, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Docs", identifier="DOC", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=15, is_active=True)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    return project


@pytest.fixture
def colleague(workspace, project):
    user = User.objects.create(email=f"c-{uuid4().hex[:8]}@plane.so", username=uuid4().hex[:8])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    ProjectMember.objects.create(project=project, member=user, role=15, is_active=True)
    return user


def _page(workspace, project, owner, access):
    page = Page.objects.create(
        name="Notes", description_html="<p>secret</p>", workspace=workspace, owned_by=owner, access=access
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=page)
    return page


def _base(workspace, project, page):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}"


def test_private_page_of_someone_else_is_out_of_reach(api_key_client, workspace, project, colleague):
    page = _page(workspace, project, colleague, Page.PRIVATE_ACCESS)
    version = PageVersion.objects.create(
        page=page, workspace=workspace, owned_by=colleague, description_html="<p>secret</p>"
    )
    comment = PageComment.objects.create(page=page, comment_html="<p>c</p>", actor=colleague)
    base = _base(workspace, project, page)

    requests = [
        ("get", f"{base}/versions/", None),
        ("get", f"{base}/versions/{version.id}/", None),
        ("post", f"{base}/versions/", {"description_html": "<p>x</p>"}),
        ("get", f"{base}/comments/", None),
        ("post", f"{base}/comments/", {"comment_html": "<p>x</p>"}),
        ("get", f"{base}/comments/{comment.id}/", None),
        ("post", f"{base}/comments/{comment.id}/resolve/", None),
    ]
    for method, url, body in requests:
        response = getattr(api_key_client, method)(url, body, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN, (method, url, response.content)


def test_own_private_page_is_reachable(api_key_client, workspace, project, create_user):
    page = _page(workspace, project, create_user, Page.PRIVATE_ACCESS)
    base = _base(workspace, project, page)

    assert api_key_client.get(f"{base}/versions/").status_code == status.HTTP_200_OK
    assert api_key_client.get(f"{base}/comments/").status_code == status.HTTP_200_OK


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_member_cannot_change_a_comment_of_someone_else(api_key_client, workspace, project, colleague, method):
    page = _page(workspace, project, colleague, Page.PUBLIC_ACCESS)
    comment = PageComment.objects.create(page=page, comment_html="<p>theirs</p>", actor=colleague)

    response = getattr(api_key_client, method)(
        f"{_base(workspace, project, page)}/comments/{comment.id}/", {"comment_html": "<p>mine</p>"}, format="json"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN, response.content
    comment.refresh_from_db()
    assert comment.comment_html == "<p>theirs</p>"


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_admin_can_change_a_comment_of_someone_else(api_key_client, workspace, project, colleague, create_user, method):
    ProjectMember.objects.filter(project=project, member=create_user).update(role=20)
    page = _page(workspace, project, colleague, Page.PUBLIC_ACCESS)
    comment = PageComment.objects.create(page=page, comment_html="<p>theirs</p>", actor=colleague)

    response = getattr(api_key_client, method)(
        f"{_base(workspace, project, page)}/comments/{comment.id}/", {"comment_html": "<p>edited</p>"}, format="json"
    )

    assert response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT), response.content
