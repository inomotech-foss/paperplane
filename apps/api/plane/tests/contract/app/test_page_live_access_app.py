# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, Workspace, WorkspaceMember
from plane.tests.openapi import documented

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ADMIN, MEMBER, GUEST = 20, 15, 5


def make_user():
    return User.objects.create(email=f"{uuid.uuid4().hex[:8]}@plane.so", username=uuid.uuid4().hex[:8])


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def make_project(workspace, identifier="LIVE", **fields):
    return Project.objects.create(name=identifier, identifier=identifier, workspace=workspace, **fields)


def add_member(workspace, project, user, role):
    WorkspaceMember.objects.get_or_create(workspace=workspace, member=user, defaults={"role": role})
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=role)


def make_page(workspace, project, owner, access=Page.PUBLIC_ACCESS, **fields):
    page = Page.objects.create(workspace=workspace, owned_by=owner, access=access, name="Page", **fields)
    ProjectPage.objects.create(workspace=workspace, project=project, page=page)
    return page


def live_access(client, workspace, project, page):
    return client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/live-access/")


@pytest.fixture
def project(workspace, create_user):
    project = make_project(workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def owner(workspace, project):
    user = make_user()
    add_member(workspace, project, user, MEMBER)
    return user


def test_owner_edits_private_page(session_client, workspace, project, create_user):
    page = make_page(workspace, project, create_user, access=Page.PRIVATE_ACCESS)

    response = live_access(session_client, workspace, project, page)

    assert documented(response) == {"access": "edit"}


@pytest.mark.parametrize("role", [ADMIN, MEMBER])
def test_member_edits_public_page(workspace, project, owner, role):
    user = make_user()
    add_member(workspace, project, user, role)
    page = make_page(workspace, project, owner)

    assert live_access(client_for(user), workspace, project, page).data == {"access": "edit"}


@pytest.mark.parametrize("role", [ADMIN, MEMBER, GUEST])
def test_private_page_is_owner_only(workspace, project, owner, role):
    user = make_user()
    add_member(workspace, project, user, role)
    page = make_page(workspace, project, owner, access=Page.PRIVATE_ACCESS)

    assert live_access(client_for(user), workspace, project, page).status_code == status.HTTP_403_FORBIDDEN


def test_guest_is_denied_without_guest_view_all_features(workspace, project, owner):
    guest = make_user()
    add_member(workspace, project, guest, GUEST)
    page = make_page(workspace, project, owner)

    assert live_access(client_for(guest), workspace, project, page).status_code == status.HTTP_403_FORBIDDEN


def test_guest_reads_with_guest_view_all_features(workspace, owner):
    project = make_project(workspace, "GVA", guest_view_all_features=True)
    add_member(workspace, project, owner, MEMBER)
    guest = make_user()
    add_member(workspace, project, guest, GUEST)
    page = make_page(workspace, project, owner)

    assert live_access(client_for(guest), workspace, project, page).data == {"access": "read"}


def test_guest_edits_own_page(workspace, project):
    guest = make_user()
    add_member(workspace, project, guest, GUEST)
    page = make_page(workspace, project, guest)

    assert live_access(client_for(guest), workspace, project, page).data == {"access": "edit"}


def test_workspace_member_outside_the_project_is_denied(workspace, project, owner):
    user = make_user()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=MEMBER)
    page = make_page(workspace, project, owner)

    assert live_access(client_for(user), workspace, project, page).status_code == status.HTTP_403_FORBIDDEN


def test_inactive_project_member_is_denied(workspace, project, owner):
    user = make_user()
    add_member(workspace, project, user, MEMBER)
    ProjectMember.objects.filter(member=user).update(is_active=False)
    page = make_page(workspace, project, owner)

    assert live_access(client_for(user), workspace, project, page).status_code == status.HTTP_403_FORBIDDEN


def test_member_of_another_workspace_is_denied(workspace, project, owner):
    other_owner = make_user()
    other_workspace = Workspace.objects.create(name="Other", owner=other_owner, slug="other-workspace")
    other_project = make_project(other_workspace, "OTH")
    add_member(other_workspace, other_project, other_owner, ADMIN)
    page = make_page(workspace, project, owner)
    client = client_for(other_owner)

    assert live_access(client, workspace, project, page).status_code == status.HTTP_403_FORBIDDEN
    assert live_access(client, other_workspace, other_project, page).status_code == status.HTTP_403_FORBIDDEN


def test_page_must_belong_to_the_project_in_the_url(session_client, workspace, project, owner, create_user):
    other_project = make_project(workspace, "OTHER")
    ProjectMember.objects.create(workspace=workspace, project=other_project, member=create_user, role=ADMIN)
    page = make_page(workspace, project, owner)
    ProjectMember.objects.filter(project=project, member=create_user).delete()

    response = live_access(session_client, workspace, other_project, page)

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_page_removed_from_the_project_is_denied(session_client, workspace, project, create_user):
    page = make_page(workspace, project, create_user)
    ProjectPage.objects.get(page=page).delete()

    assert live_access(session_client, workspace, project, page).status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.parametrize("state", [{"is_locked": True}, {"archived_at": timezone.now().date()}])
def test_locked_or_archived_page_is_read_only(session_client, workspace, project, owner, create_user, state):
    own_page = make_page(workspace, project, create_user, access=Page.PRIVATE_ACCESS, **state)
    other_page = make_page(workspace, project, owner, **state)

    assert live_access(session_client, workspace, project, own_page).data == {"access": "read"}
    assert live_access(session_client, workspace, project, other_page).data == {"access": "read"}


def test_anonymous_is_denied(api_client, workspace, project, create_user):
    page = make_page(workspace, project, create_user)

    response = live_access(api_client, workspace, project, page)

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
