# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Page, Project, ProjectMember, ProjectPage

UNSAFE_HTML = '<p>hello</p><script>alert(1)</script><img src="x" onerror="alert(2)">'


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def page(db, workspace, project, create_user):
    page = Page.objects.create(
        name="Page",
        description_html="<p></p>",
        workspace=workspace,
        owned_by=create_user,
        created_by=create_user,
        access=Page.PUBLIC_ACCESS,
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=page, created_by=create_user)
    return page


def assert_sanitized(html):
    assert "<p>hello</p>" in html
    assert "<script" not in html
    assert "onerror" not in html


@pytest.mark.contract
@pytest.mark.django_db
class TestPageDescriptionSanitizing:
    def pages_url(self, workspace, project):
        return f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/"

    def test_create_sanitizes_description_html(self, session_client, workspace, project):
        response = session_client.post(
            self.pages_url(workspace, project), {"name": "New", "description_html": UNSAFE_HTML}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert_sanitized(response.data["description_html"])
        assert_sanitized(Page.objects.get(pk=response.data["id"]).description_html)

    def test_create_decodes_description_binary(self, session_client, workspace, project):
        state = b"\x01\x02\x03\x04yjs-state"
        response = session_client.post(
            self.pages_url(workspace, project),
            {"name": "New", "description_binary": base64.b64encode(state).decode()},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert bytes(Page.objects.get(pk=response.data["id"]).description_binary) == state

    def test_create_rejects_invalid_description_binary(self, session_client, workspace, project):
        payload = base64.b64encode(b"<script>alert(1)</script>").decode()
        response = session_client.post(
            self.pages_url(workspace, project), {"name": "New", "description_binary": payload}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "description_binary" in response.data
        assert not Page.objects.filter(name="New").exists()

    def test_patch_sanitizes_description_html(self, session_client, workspace, project, page):
        response = session_client.patch(
            f"{self.pages_url(workspace, project)}{page.id}/", {"description_html": UNSAFE_HTML}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert_sanitized(response.data["description_html"])
        page.refresh_from_db()
        assert_sanitized(page.description_html)

    def test_patch_allows_an_empty_description(self, session_client, workspace, project, page):
        response = session_client.patch(
            f"{self.pages_url(workspace, project)}{page.id}/", {"description_html": ""}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.description_html == ""

    def test_patch_refuses_the_description_of_an_archived_page(self, session_client, workspace, project, page):
        Page.objects.filter(pk=page.pk).update(archived_at=timezone.now())
        response = session_client.patch(
            f"{self.pages_url(workspace, project)}{page.id}/", {"description_html": "<p>new</p>"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json()["error_message"] == "PAGE_ARCHIVED"
        page.refresh_from_db()
        assert page.description_html == "<p></p>"
