# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest import mock
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from plane.db.models import FileAsset, Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember

S3_STORAGE_PATH = "plane.app.views.page.attachment.S3Storage"


def collection_url(slug, project_id, page_id):
    return f"/api/assets/v2/workspaces/{slug}/projects/{project_id}/pages/{page_id}/attachments/"


def detail_url(slug, project_id, page_id, pk):
    return f"{collection_url(slug, project_id, page_id)}{pk}/"


def make_project(workspace, user, name, identifier):
    project = Project.objects.create(name=name, identifier=identifier, workspace=workspace, created_by=user)
    ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=20)
    return project


def make_page(workspace, project, user, name="Spec"):
    page = Page.objects.create(workspace=workspace, name=name, owned_by=user, access=Page.PUBLIC_ACCESS)
    ProjectPage.objects.create(project=project, page=page, workspace=workspace)
    return page


@pytest.fixture
def project(db, workspace, create_user):
    return make_project(workspace, create_user, "Test Project", "TP")


@pytest.fixture
def page(db, workspace, project, create_user):
    return make_page(workspace, project, create_user)


@pytest.fixture
def attachment(db, workspace, project, page, create_user):
    return FileAsset.objects.create(
        attributes={"name": "spec.pdf", "type": "application/pdf", "size": 1024},
        asset=f"{workspace.id}/spec.pdf",
        size=1024,
        workspace=workspace,
        project=project,
        page=page,
        created_by=create_user,
        entity_type=FileAsset.EntityTypeContext.PAGE_ATTACHMENT,
        is_uploaded=True,
        storage_metadata={"size": 1024},
    )


@pytest.fixture
def outsider_client(db, workspace):
    unique_id = uuid4().hex[:8]
    user = User.objects.create(email=f"outsider-{unique_id}@plane.so", username=f"outsider_{unique_id}")
    user.set_password("test-password")
    user.save()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.contract
@pytest.mark.django_db
class TestPageAttachmentUpload:
    def test_post_reserves_an_asset_and_returns_a_presigned_url(self, session_client, workspace, project, page):
        with mock.patch(S3_STORAGE_PATH) as storage:
            storage.return_value.generate_presigned_post.return_value = {"url": "https://s3.test"}
            response = session_client.post(
                collection_url(workspace.slug, project.id, page.id),
                {"name": "spec.pdf", "type": "application/pdf", "size": 2048},
                format="json",
            )

        assert response.status_code == 200, response.data
        asset = FileAsset.objects.get(id=response.data["asset_id"])
        assert asset.page_id == page.id
        assert asset.project_id == project.id
        assert asset.entity_type == FileAsset.EntityTypeContext.PAGE_ATTACHMENT
        # Not listed until the client confirms the upload.
        assert asset.is_uploaded is False

    def test_post_rejects_a_disallowed_type(self, session_client, workspace, project, page):
        response = session_client.post(
            collection_url(workspace.slug, project.id, page.id),
            {"name": "evil.exe", "type": "application/x-msdownload", "size": 10},
            format="json",
        )

        assert response.status_code == 400
        assert FileAsset.objects.count() == 0

    def test_patch_marks_it_uploaded(self, session_client, workspace, project, page, attachment):
        attachment.is_uploaded = False
        attachment.save()

        response = session_client.patch(detail_url(workspace.slug, project.id, page.id, attachment.id))

        assert response.status_code == 204
        attachment.refresh_from_db()
        assert attachment.is_uploaded is True

    def test_patch_does_not_reassign_created_by(
        self, session_client, workspace, project, page, attachment, create_user
    ):
        other = User.objects.create(email="other@plane.so", username="other")
        # UPDATE, not save(): BaseModel.save() rewrites the audit fields from
        # the current user, which would null created_by before the request.
        FileAsset.objects.filter(pk=attachment.pk).update(created_by=other, is_uploaded=False)

        session_client.patch(detail_url(workspace.slug, project.id, page.id, attachment.id))

        attachment.refresh_from_db()
        assert attachment.created_by_id == other.id
        assert attachment.is_uploaded is True


@pytest.mark.contract
@pytest.mark.django_db
class TestPageAttachmentListing:
    def test_lists_only_uploaded_attachments_for_the_page(self, session_client, workspace, project, page, attachment):
        FileAsset.objects.create(
            attributes={"name": "pending.pdf"},
            asset="pending.pdf",
            workspace=workspace,
            project=project,
            page=page,
            entity_type=FileAsset.EntityTypeContext.PAGE_ATTACHMENT,
            is_uploaded=False,
        )
        # An inline editor image on the same page must not appear in the list.
        FileAsset.objects.create(
            attributes={"name": "inline.png"},
            asset="inline.png",
            workspace=workspace,
            project=project,
            page=page,
            entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
            is_uploaded=True,
        )

        response = session_client.get(collection_url(workspace.slug, project.id, page.id))

        assert response.status_code == 200
        assert [item["attributes"]["name"] for item in response.data] == ["spec.pdf"]

    def test_does_not_leak_another_pages_attachments(
        self, session_client, workspace, project, page, attachment, create_user
    ):
        other_page = make_page(workspace, project, create_user, name="Other")

        response = session_client.get(collection_url(workspace.slug, project.id, other_page.id))

        assert response.status_code == 200
        assert response.data == []

    def test_download_redirects_to_a_presigned_url(self, session_client, workspace, project, page, attachment):
        with mock.patch(S3_STORAGE_PATH) as storage:
            storage.return_value.generate_presigned_url.return_value = "https://s3.test/spec.pdf"
            response = session_client.get(detail_url(workspace.slug, project.id, page.id, attachment.id))

        assert response.status_code == 302
        assert response.url == "https://s3.test/spec.pdf"

    def test_download_of_an_unuploaded_asset_is_rejected(self, session_client, workspace, project, page, attachment):
        attachment.is_uploaded = False
        attachment.save()

        response = session_client.get(detail_url(workspace.slug, project.id, page.id, attachment.id))

        assert response.status_code == 400


@pytest.mark.contract
@pytest.mark.django_db
class TestPageAttachmentDelete:
    def test_delete_soft_deletes(self, session_client, workspace, project, page, attachment):
        response = session_client.delete(detail_url(workspace.slug, project.id, page.id, attachment.id))

        assert response.status_code == 204
        assert not FileAsset.objects.filter(pk=attachment.pk).exists()

    def test_delete_of_an_unknown_id_is_404(self, session_client, workspace, project, page):
        response = session_client.delete(detail_url(workspace.slug, project.id, page.id, uuid4()))

        assert response.status_code == 404


@pytest.mark.contract
@pytest.mark.django_db
class TestPageAttachmentScope:
    """Page attachments inherit ProjectPagePermission, so the cross-project
    leaks it guards against (GHSA-g49r / GHSA-ghcr) must stay closed."""

    def test_non_project_member_is_denied(self, outsider_client, workspace, project, page, attachment):
        response = outsider_client.get(collection_url(workspace.slug, project.id, page.id))

        assert response.status_code in (401, 403)

    def test_page_from_another_project_is_denied(self, session_client, workspace, project, create_user, attachment):
        other_project = make_project(workspace, create_user, "Other Project", "OP")

        response = session_client.get(collection_url(workspace.slug, other_project.id, attachment.page_id))

        assert response.status_code in (401, 403)

    def test_anonymous_is_denied(self, api_client, workspace, project, page):
        response = api_client.get(collection_url(workspace.slug, project.id, page.id))

        assert response.status_code in (401, 403)
