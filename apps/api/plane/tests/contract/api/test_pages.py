# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from unittest import mock

import pytest
from rest_framework import status
from uuid import uuid4

from plane.db.models import Page, Project, ProjectMember, ProjectPage
from plane.utils import live_content


@pytest.fixture
def project(db, workspace, create_user):
    """Create a test project with the user as a member"""
    project = Project.objects.create(
        name="Test Project",
        identifier="TP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=create_user,
        role=20,  # Admin role
        is_active=True,
    )
    return project


@pytest.fixture
def page_data():
    """Sample page data for tests"""
    return {
        "name": "Test Page",
        "description_html": "<p>Imported from Confluence</p>",
    }


@pytest.fixture
def create_page(db, workspace, project, create_user):
    """Create a test page linked to the project"""
    page = Page.objects.create(
        name="Existing Page",
        description_html="<p>Existing content</p>",
        workspace=workspace,
        owned_by=create_user,
        created_by=create_user,
    )
    ProjectPage.objects.create(
        workspace=workspace,
        project=project,
        page=page,
        created_by=create_user,
    )
    return page


@pytest.mark.contract
class TestPageListCreateAPIEndpoint:
    """Test Page List and Create API Endpoint"""

    def get_page_url(self, workspace_slug, project_id):
        """Helper to get page endpoint URL"""
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/pages/"

    @pytest.mark.django_db
    def test_create_page_success(self, api_key_client, workspace, project, create_user, page_data):
        """Test successful page creation"""
        url = self.get_page_url(workspace.slug, project.id)

        response = api_key_client.post(url, page_data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert Page.objects.count() == 1

        created_page = Page.objects.first()
        assert created_page.name == page_data["name"]
        assert created_page.description_html == page_data["description_html"]
        assert created_page.workspace == workspace
        assert created_page.owned_by == create_user
        assert created_page.access == Page.PUBLIC_ACCESS
        # The page must be linked to the project so it shows up in the UI
        assert ProjectPage.objects.filter(page=created_page, project=project).exists()

    @pytest.mark.django_db
    def test_create_page_with_parent(self, api_key_client, workspace, project, create_page):
        """Test creating a nested page under an existing parent"""
        url = self.get_page_url(workspace.slug, project.id)

        page_data = {
            "name": "Child Page",
            "description_html": "<p>Nested content</p>",
            "parent": str(create_page.id),
        }

        response = api_key_client.post(url, page_data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        child_page = Page.objects.get(name="Child Page")
        assert child_page.parent_id == create_page.id

    @pytest.mark.django_db
    def test_create_page_with_unknown_parent(self, api_key_client, workspace, project):
        """Test creating a page with a parent outside the project fails"""
        url = self.get_page_url(workspace.slug, project.id)

        page_data = {
            "name": "Orphan Page",
            "parent": str(uuid4()),
        }

        response = api_key_client.post(url, page_data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_create_page_with_external_id(self, api_key_client, workspace, project):
        """Test creating page with external ID"""
        url = self.get_page_url(workspace.slug, project.id)

        page_data = {
            "name": "External Page",
            "external_id": "conf-123",
            "external_source": "confluence",
        }

        response = api_key_client.post(url, page_data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        created_page = Page.objects.first()
        assert created_page.external_id == "conf-123"
        assert created_page.external_source == "confluence"

    @pytest.mark.django_db
    def test_create_page_duplicate_external_id(self, api_key_client, workspace, project, create_page):
        """Test creating page with duplicate external ID"""
        url = self.get_page_url(workspace.slug, project.id)

        create_page.external_id = "conf-123"
        create_page.external_source = "confluence"
        create_page.save()

        page_data = {
            "name": "Second Page",
            "external_id": "conf-123",
            "external_source": "confluence",
        }

        response = api_key_client.post(url, page_data, format="json")

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "same external id" in response.data["error"]
        assert response.data["id"] == str(create_page.id)

    @pytest.mark.django_db
    def test_list_pages_success(self, api_key_client, workspace, project, create_user, create_page):
        """Test successful page listing"""
        url = self.get_page_url(workspace.slug, project.id)

        # Create additional pages
        for name in ["Page 2", "Page 3"]:
            page = Page.objects.create(name=name, workspace=workspace, owned_by=create_user)
            ProjectPage.objects.create(workspace=workspace, project=project, page=page)

        response = api_key_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert len(response.data["results"]) == 3  # Including create_page fixture

    @pytest.mark.django_db
    def test_list_pages_excludes_other_projects(self, api_key_client, workspace, project, create_user, create_page):
        """Test that pages of other projects are not listed"""
        other_project = Project.objects.create(
            name="Other Project",
            identifier="OP",
            workspace=workspace,
            created_by=create_user,
        )
        ProjectMember.objects.create(project=other_project, member=create_user, role=20, is_active=True)
        other_page = Page.objects.create(name="Other Page", workspace=workspace, owned_by=create_user)
        ProjectPage.objects.create(workspace=workspace, project=other_project, page=other_page)

        response = api_key_client.get(self.get_page_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_200_OK
        page_ids = [row["id"] for row in response.data["results"]]
        assert create_page.id in page_ids
        assert other_page.id not in page_ids

    @pytest.mark.django_db
    def test_pages_unauthenticated(self, api_client, workspace, project):
        """Test that requests without an API key are rejected"""
        url = self.get_page_url(workspace.slug, project.id)

        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        response = api_client.post(url, {"name": "No Auth"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.contract
class TestPageDetailAPIEndpoint:
    """Test Page Detail API Endpoint"""

    def get_page_detail_url(self, workspace_slug, project_id, page_id):
        """Helper to get page detail endpoint URL"""
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/pages/{page_id}/"

    @pytest.mark.django_db
    def test_get_page_success(self, api_key_client, workspace, project, create_page):
        """Test successful page retrieval"""
        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        response = api_key_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == create_page.id
        assert response.data["name"] == create_page.name
        assert response.data["description_html"] == create_page.description_html

    @pytest.mark.django_db
    def test_get_page_not_found(self, api_key_client, workspace, project):
        """Test getting non-existent page"""
        fake_id = uuid4()
        url = self.get_page_detail_url(workspace.slug, project.id, fake_id)

        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_get_page_unauthenticated(self, api_client, workspace, project, create_page):
        """Test that retrieval without an API key is rejected"""
        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_update_page_success(self, api_key_client, workspace, project, create_page):
        """Test successful page update"""
        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        update_data = {
            "name": "Updated Page",
            "description_html": "<p>Updated content</p>",
        }

        response = api_key_client.patch(url, update_data, format="json")

        assert response.status_code == status.HTTP_200_OK

        create_page.refresh_from_db()
        assert create_page.name == update_data["name"]
        assert create_page.description_html == update_data["description_html"]

    @pytest.mark.django_db
    def test_update_page_parent(self, api_key_client, workspace, project, create_user, create_page):
        """Test nesting a page under a parent via patch"""
        parent = Page.objects.create(name="Parent Page", workspace=workspace, owned_by=create_user)
        ProjectPage.objects.create(workspace=workspace, project=project, page=parent)

        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        response = api_key_client.patch(url, {"parent": str(parent.id)}, format="json")

        assert response.status_code == status.HTTP_200_OK
        create_page.refresh_from_db()
        assert create_page.parent_id == parent.id

    @pytest.mark.django_db
    def test_update_page_parent_rejects_a_cycle(self, api_key_client, workspace, project, create_user, create_page):
        """Test that a page cannot be nested under its own child via patch"""
        child = Page.objects.create(name="Child", workspace=workspace, owned_by=create_user, parent=create_page)
        ProjectPage.objects.create(workspace=workspace, project=project, page=child)

        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        response = api_key_client.patch(url, {"parent": str(child.id), "name": "Renamed"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        create_page.refresh_from_db()
        assert create_page.parent_id is None
        assert create_page.name == "Existing Page"

    @pytest.mark.django_db
    def test_move_locked_page(self, api_key_client, workspace, project, create_user, create_page):
        """Test that a lock does not stop a move"""
        parent = Page.objects.create(name="Parent Page", workspace=workspace, owned_by=create_user)
        ProjectPage.objects.create(workspace=workspace, project=project, page=parent)
        create_page.is_locked = True
        create_page.save()

        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        response = api_key_client.patch(url, {"parent": str(parent.id)}, format="json")

        assert response.status_code == status.HTTP_200_OK
        create_page.refresh_from_db()
        assert create_page.parent_id == parent.id

    @pytest.mark.django_db
    def test_move_locked_page_with_content_change(self, api_key_client, workspace, project, create_user, create_page):
        """Test that a move does not let content changes through a lock"""
        parent = Page.objects.create(name="Parent Page", workspace=workspace, owned_by=create_user)
        ProjectPage.objects.create(workspace=workspace, project=project, page=parent)
        create_page.is_locked = True
        create_page.save()

        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        response = api_key_client.patch(url, {"parent": str(parent.id), "name": "New Name"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        create_page.refresh_from_db()
        assert create_page.parent_id is None
        assert create_page.name == "Existing Page"

    @pytest.mark.django_db
    def test_update_locked_page(self, api_key_client, workspace, project, create_page):
        """Test that locked pages cannot be updated"""
        create_page.is_locked = True
        create_page.save()

        url = self.get_page_detail_url(workspace.slug, project.id, create_page.id)

        response = api_key_client.patch(url, {"name": "New Name"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.fixture
def live_events():
    """The events the API hands to the live servers, and the background tasks it queues."""
    redis = mock.Mock()
    with (
        mock.patch.object(live_content, "_redis", return_value=redis),
        mock.patch("plane.api.views.page.track_page_version") as track_page_version,
        mock.patch("plane.api.views.page.page_transaction") as page_transaction,
    ):
        yield mock.Mock(
            published=lambda: [
                json.loads(call.args[1])
                for call in redis.publish.call_args_list
                if call.args[0] == "paperplane:live-content"
            ],
            track_page_version=track_page_version,
            page_transaction=page_transaction,
        )


@pytest.mark.contract
@pytest.mark.django_db
class TestPageBodyUpdateKeepsTheEditorInStep:
    """A body written through the API must reach the collaborative editor, not be overwritten by it."""

    def url(self, workspace, project, page):
        return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/"

    @pytest.fixture
    def opened_page(self, create_page):
        """A page the editor has already saved, so it carries a binary and JSON copy of the old body."""
        create_page.description_binary = b"stale yjs state"
        create_page.description_json = {"type": "doc", "content": [{"type": "paragraph"}]}
        create_page.save()
        return create_page

    def test_new_body_drops_the_stale_editor_copies(
        self, api_key_client, workspace, project, opened_page, live_events, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            response = api_key_client.patch(
                self.url(workspace, project, opened_page), {"description_html": "<p>Revised</p>"}, format="json"
            )

        assert response.status_code == status.HTTP_200_OK
        opened_page.refresh_from_db()
        assert opened_page.description_html == "<p>Revised</p>"
        assert opened_page.description_stripped == "Revised"
        # live rebuilds both from the HTML the next time the page loads
        assert opened_page.description_binary is None
        assert opened_page.description_json == {}

    def test_new_body_is_handed_to_open_documents(
        self, api_key_client, workspace, project, opened_page, live_events, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            api_key_client.patch(
                self.url(workspace, project, opened_page), {"description_html": "<p>Revised</p>"}, format="json"
            )

        [event] = live_events.published()
        assert event["page"] == str(opened_page.id)
        assert event["html"] == "<p>Revised</p>"
        assert event["id"]

    def test_new_body_is_versioned_like_an_editor_save(
        self, api_key_client, workspace, project, create_user, opened_page, live_events
    ):
        api_key_client.patch(
            self.url(workspace, project, opened_page), {"description_html": "<p>Revised</p>"}, format="json"
        )

        live_events.track_page_version.delay.assert_called_once_with(
            page_id=str(opened_page.id),
            existing_instance=json.dumps({"description_html": "<p>Existing content</p>"}),
            user_id=str(create_user.id),
        )
        live_events.page_transaction.delay.assert_called_once_with(
            new_description_html="<p>Revised</p>",
            old_description_html="<p>Existing content</p>",
            page_id=str(opened_page.id),
            actor_id=str(create_user.id),
        )

    @pytest.mark.parametrize(
        "change",
        [{"name": "Renamed"}, {"description_html": "<p>Existing content</p>"}],
        ids=["name only", "same body"],
    )
    def test_unchanged_body_keeps_the_editor_copies(
        self, api_key_client, workspace, project, opened_page, live_events, django_capture_on_commit_callbacks, change
    ):
        with django_capture_on_commit_callbacks(execute=True):
            response = api_key_client.patch(self.url(workspace, project, opened_page), change, format="json")

        assert response.status_code == status.HTTP_200_OK
        opened_page.refresh_from_db()
        assert bytes(opened_page.description_binary) == b"stale yjs state"
        assert opened_page.description_json == {"type": "doc", "content": [{"type": "paragraph"}]}
        assert live_events.published() == []
        live_events.track_page_version.delay.assert_not_called()

    def test_refused_body_changes_nothing(
        self, api_key_client, workspace, project, opened_page, live_events, django_capture_on_commit_callbacks
    ):
        opened_page.is_locked = True
        opened_page.save()

        with django_capture_on_commit_callbacks(execute=True):
            response = api_key_client.patch(
                self.url(workspace, project, opened_page), {"description_html": "<p>Revised</p>"}, format="json"
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        opened_page.refresh_from_db()
        assert bytes(opened_page.description_binary) == b"stale yjs state"
        assert live_events.published() == []
