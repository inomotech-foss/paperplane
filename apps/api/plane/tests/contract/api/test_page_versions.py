# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for importing page history via the public v1 versions endpoint."""

from datetime import datetime, timezone as dt_timezone

import pytest
from rest_framework import status

from plane.db.models import Page, PageVersion, Project, ProjectMember, ProjectPage, User


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def page(db, workspace, project, create_user):
    page = Page.objects.create(
        name="Imported Page",
        description_html="<p>Current body</p>",
        workspace=workspace,
        owned_by=create_user,
        created_by=create_user,
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=page, created_by=create_user)
    return page


def base_url(slug, project_id, page_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/pages/{page_id}/versions/"


@pytest.mark.contract
class TestPageVersionImportV1Endpoint:
    @pytest.mark.django_db
    def test_import_batch_preserves_timestamps(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        response = api_key_client.post(
            url,
            {
                "versions": [
                    {
                        "description_html": "<p>First draft</p>",
                        "last_saved_at": "2021-03-04T10:00:00Z",
                        "external_source": "confluence",
                        "external_id": "8192161/1",
                    },
                    {
                        "description_html": "<p>Second draft</p>",
                        "last_saved_at": "2021-05-06T12:30:00Z",
                        "external_source": "confluence",
                        "external_id": "8192161/2",
                    },
                ]
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["created"] == 2
        assert response.data["skipped"] == 0

        # the original timestamps survive, rather than being stamped with "now"
        first = PageVersion.objects.get(external_id="8192161/1")
        assert first.last_saved_at == datetime(2021, 3, 4, 10, 0, tzinfo=dt_timezone.utc)
        # created_at too, so the history sorts by when it happened upstream
        assert first.created_at == first.last_saved_at
        assert first.description_html == "<p>First draft</p>"

    @pytest.mark.django_db
    def test_rerun_is_idempotent(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        payload = {
            "versions": [
                {
                    "description_html": "<p>First draft</p>",
                    "external_source": "confluence",
                    "external_id": "8192161/1",
                }
            ]
        }
        assert api_key_client.post(url, payload, format="json").data["created"] == 1
        again = api_key_client.post(url, payload, format="json")
        assert again.data["created"] == 0
        assert again.data["skipped"] == 1
        assert PageVersion.objects.filter(external_id="8192161/1").count() == 1

    @pytest.mark.django_db
    def test_duplicates_within_one_batch_collapse(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        entry = {
            "description_html": "<p>First draft</p>",
            "external_source": "confluence",
            "external_id": "8192161/1",
        }
        response = api_key_client.post(url, {"versions": [entry, entry]}, format="json")
        assert response.data["created"] == 1
        assert response.data["skipped"] == 1

    @pytest.mark.django_db
    def test_import_leaves_the_current_page_alone(self, api_key_client, workspace, project, page):
        """History is the page's past; importing it must not rewrite the present."""
        url = base_url(workspace.slug, project.id, page.id)
        api_key_client.post(url, {"description_html": "<p>Ancient body</p>"}, format="json")
        page.refresh_from_db()
        assert page.description_html == "<p>Current body</p>"

    @pytest.mark.django_db
    def test_single_object_body_is_accepted(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        response = api_key_client.post(url, {"description_html": "<p>Only version</p>"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["created"] == 1

    @pytest.mark.django_db
    def test_version_without_a_body_is_rejected(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        response = api_key_client.post(url, {"versions": [{"last_saved_at": "2021-03-04T10:00:00Z"}]}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_unsafe_html_is_sanitized(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        api_key_client.post(
            url,
            {"description_html": "<p>Body</p><script>alert(1)</script>"},
            format="json",
        )
        stored = PageVersion.objects.get(page_id=page.id)
        assert "<script>" not in stored.description_html
        assert "<p>Body</p>" in stored.description_html

    @pytest.mark.django_db
    def test_stripped_text_is_derived(self, api_key_client, workspace, project, page):
        """bulk_create skips model.save(), so the search column has to be filled by hand."""
        url = base_url(workspace.slug, project.id, page.id)
        api_key_client.post(url, {"description_html": "<p>Searchable body</p>"}, format="json")
        assert PageVersion.objects.get(page_id=page.id).description_stripped.strip() == "Searchable body"

    @pytest.mark.django_db
    def test_author_defaults_to_the_page_owner(self, api_key_client, workspace, project, page, create_user):
        url = base_url(workspace.slug, project.id, page.id)
        api_key_client.post(url, {"description_html": "<p>Anonymous edit</p>"}, format="json")
        assert PageVersion.objects.get(page_id=page.id).owned_by_id == create_user.id

    @pytest.mark.django_db
    def test_author_is_preserved_when_given(self, api_key_client, workspace, project, page):
        author = User.objects.create(email="author@plane.so", username="oldauthor", first_name="Old")
        url = base_url(workspace.slug, project.id, page.id)
        api_key_client.post(
            url,
            {"description_html": "<p>Their edit</p>", "owned_by": str(author.id)},
            format="json",
        )
        assert PageVersion.objects.get(page_id=page.id).owned_by_id == author.id

    @pytest.mark.django_db
    def test_unknown_page_is_404(self, api_key_client, workspace, project):
        url = base_url(workspace.slug, project.id, "00000000-0000-0000-0000-000000000000")
        response = api_key_client.post(url, {"description_html": "<p>Body</p>"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_imported_history_is_listed_newest_first(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        api_key_client.post(
            url,
            {
                "versions": [
                    {
                        "description_html": "<p>First draft</p>",
                        "last_saved_at": "2021-03-04T10:00:00Z",
                        "external_source": "confluence",
                        "external_id": "8192161/1",
                    },
                    {
                        "description_html": "<p>Second draft</p>",
                        "last_saved_at": "2021-05-06T12:30:00Z",
                        "external_source": "confluence",
                        "external_id": "8192161/2",
                    },
                ]
            },
            format="json",
        )
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert [version["external_id"] for version in results] == ["8192161/2", "8192161/1"]
        # the list stays cheap: bodies are only served by the detail route
        assert "description_html" not in results[0]

    @pytest.mark.django_db
    def test_single_version_is_retrieved_with_its_body(self, api_key_client, workspace, project, page):
        url = base_url(workspace.slug, project.id, page.id)
        created = api_key_client.post(
            url,
            {
                "description_html": "<p>First draft</p>",
                "external_source": "confluence",
                "external_id": "8192161/1",
            },
            format="json",
        ).data["versions"][0]

        response = api_key_client.get(f"{url}{created['id']}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["description_html"] == "<p>First draft</p>"
        assert response.data["external_id"] == "8192161/1"

    @pytest.mark.django_db
    def test_versions_of_a_page_in_another_project_are_not_reachable(
        self, api_key_client, workspace, project, page, create_user
    ):
        """The project in the URL is the scope, not just a decoration (GHSA-g49r)."""
        other = Project.objects.create(
            name="Other Project", identifier="OP", workspace=workspace, created_by=create_user
        )
        ProjectMember.objects.create(project=other, member=create_user, role=20, is_active=True)
        api_key_client.post(
            base_url(workspace.slug, project.id, page.id),
            {"description_html": "<p>First draft</p>"},
            format="json",
        )

        response = api_key_client.get(base_url(workspace.slug, other.id, page.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
