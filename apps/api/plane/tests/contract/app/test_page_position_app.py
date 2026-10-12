# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember

MEMBER = 15
GUEST = 5


@pytest.fixture
def other_user(db, workspace):
    user = User.objects.create(email="owner@example.com", username="owner")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=20)
    return user


@pytest.fixture
def project(db, workspace, create_user, other_user):
    project = Project.objects.create(name="Wiki", identifier="WIKI", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, role=MEMBER, is_active=True)
    ProjectMember.objects.create(project=project, member=other_user, role=20, is_active=True)
    return project


def make_page(project, owner, name, sort_order=65535, parent=None, **fields):
    page = Page.objects.create(
        name=name,
        workspace=project.workspace,
        owned_by=owner,
        parent=parent,
        sort_order=sort_order,
        access=fields.pop("access", Page.PUBLIC_ACCESS),
        **fields,
    )
    ProjectPage.objects.create(workspace=project.workspace, project=project, page=page)
    return page


def position_url(project, page):
    return f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/pages/{page.id}/position/"


def ordered_names(project, parent=None):
    pages = Page.objects.filter(projects=project, parent=parent).order_by("sort_order", "name")
    return [page.name for page in pages]


@pytest.mark.contract
class TestPagePosition:
    @pytest.mark.django_db
    def test_member_moves_page_of_another_user_between_crowded_siblings(self, session_client, project, other_user):
        a = make_page(project, other_user, "A", is_locked=True)
        make_page(project, other_user, "B", is_locked=True)
        c = make_page(project, other_user, "C")

        response = session_client.post(position_url(project, c), {"parent": None, "after": a.id}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert ordered_names(project) == ["A", "C", "B"]
        assert {page["id"] for page in response.data["pages"]} == {
            str(page.id) for page in Page.objects.filter(projects=project)
        }

    @pytest.mark.django_db
    def test_uses_the_gap_without_touching_siblings(self, session_client, project, other_user):
        a = make_page(project, other_user, "A", sort_order=10000)
        make_page(project, other_user, "B", sort_order=20000)
        c = make_page(project, other_user, "C", sort_order=30000)

        response = session_client.post(position_url(project, c), {"parent": None, "before": a.id}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["pages"] == [{"id": str(c.id), "parent": None, "sort_order": 0.0}]
        assert ordered_names(project) == ["C", "A", "B"]

    @pytest.mark.django_db
    def test_moves_a_child_to_the_end_of_the_top_level(self, session_client, project, other_user):
        root = make_page(project, other_user, "Root", sort_order=10000)
        make_page(project, other_user, "Other", sort_order=20000)
        child = make_page(project, other_user, "Child", sort_order=10000, parent=root)

        response = session_client.post(position_url(project, child), {"parent": None}, format="json")

        assert response.status_code == status.HTTP_200_OK
        child.refresh_from_db()
        assert child.parent_id is None
        assert child.sort_order == 30000

    @pytest.mark.django_db
    def test_renumbering_keeps_hidden_parents(self, session_client, project, other_user):
        private_parent = make_page(project, other_user, "Private", access=Page.PRIVATE_ACCESS)
        orphan = make_page(project, other_user, "Orphan", parent=private_parent)
        a = make_page(project, other_user, "A")
        b = make_page(project, other_user, "B")

        response = session_client.post(position_url(project, b), {"parent": None, "before": a.id}, format="json")

        assert response.status_code == status.HTTP_200_OK
        orphan.refresh_from_db()
        assert orphan.parent_id == private_parent.id

    @pytest.mark.django_db
    def test_rejects_an_anchor_with_another_parent(self, session_client, project, other_user):
        root = make_page(project, other_user, "Root")
        child = make_page(project, other_user, "Child", parent=root)
        page = make_page(project, other_user, "Page")

        response = session_client.post(position_url(project, page), {"parent": None, "after": child.id}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_rejects_moving_a_page_under_its_descendant(self, session_client, project, other_user):
        root = make_page(project, other_user, "Root")
        child = make_page(project, other_user, "Child", parent=root)

        response = session_client.post(position_url(project, root), {"parent": child.id}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        root.refresh_from_db()
        assert root.parent_id is None

    @pytest.mark.django_db
    def test_rejects_both_anchors(self, session_client, project, other_user):
        a = make_page(project, other_user, "A")
        b = make_page(project, other_user, "B")
        c = make_page(project, other_user, "C")

        response = session_client.post(
            position_url(project, c), {"parent": None, "before": a.id, "after": b.id}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    @pytest.mark.parametrize("fields", [{"is_locked": True}, {"archived_at": timezone.now().date()}])
    def test_rejects_locked_and_archived_pages(self, session_client, project, other_user, fields):
        page = make_page(project, other_user, "Page", **fields)

        response = session_client.post(position_url(project, page), {"parent": None}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_private_page_of_another_user_is_denied(self, session_client, project, other_user):
        page = make_page(project, other_user, "Secret", access=Page.PRIVATE_ACCESS)

        response = session_client.post(position_url(project, page), {"parent": None}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_guest_is_denied(self, session_client, project, other_user, create_user):
        ProjectMember.objects.filter(project=project, member=create_user).update(role=GUEST)
        page = make_page(project, other_user, "Page")

        response = session_client.post(position_url(project, page), {"parent": None}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
class TestNewPageSortOrder:
    @pytest.mark.django_db
    def test_new_page_goes_after_its_siblings(self, session_client, project, other_user):
        make_page(project, other_user, "A", sort_order=10000)
        make_page(project, other_user, "B", sort_order=50000)
        url = f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/pages/"

        response = session_client.post(url, {"name": "New"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["sort_order"] == 60000

    @pytest.mark.django_db
    def test_duplicate_goes_after_its_siblings(self, session_client, project, other_user):
        page = make_page(project, other_user, "A", sort_order=10000)
        make_page(project, other_user, "B", sort_order=20000)
        url = f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/pages/{page.id}/duplicate/"

        response = session_client.post(url, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["sort_order"] == 30000

    @pytest.mark.django_db
    def test_archived_page_cannot_be_reparented_with_patch(self, session_client, project, other_user):
        root = make_page(project, other_user, "Root")
        page = make_page(project, other_user, "Page", archived_at=timezone.now().date())
        url = f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/pages/{page.id}/"

        response = session_client.patch(url, {"parent": str(root.id)}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
