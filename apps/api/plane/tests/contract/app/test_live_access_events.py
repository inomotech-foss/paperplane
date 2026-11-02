# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import uuid
from io import StringIO
from unittest import mock

import pytest
from django.core.management import call_command
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember
from plane.utils import live_access

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ADMIN, MEMBER, GUEST = 20, 15, 5


@pytest.fixture
def published():
    redis = mock.Mock()
    with mock.patch.object(live_access, "_redis", return_value=redis):
        yield lambda: [
            json.loads(call.args[1])
            for call in redis.publish.call_args_list
            if call.args[0] == "paperplane:live-access"
        ]


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Live", identifier="LIVE", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def member(workspace, project):
    user = User.objects.create(email=f"{uuid.uuid4().hex[:8]}@plane.so", username=uuid.uuid4().hex[:8])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=MEMBER)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=MEMBER)
    return user


def make_page(workspace, project, owner, **fields):
    page = Page.objects.create(workspace=workspace, owned_by=owner, name="Page", **fields)
    ProjectPage.objects.create(workspace=workspace, project=project, page=page)
    return page


@pytest.fixture
def page(workspace, project, create_user):
    return make_page(workspace, project, create_user)


def page_url(workspace, project, page, action):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/{action}/"


def test_publishes_only_after_commit(django_capture_on_commit_callbacks, published, page):
    with django_capture_on_commit_callbacks(execute=True):
        page.is_locked = True
        page.save()
        assert published() == []

    assert published() == [{"page": str(page.id)}]


def test_rolled_back_change_publishes_nothing(django_capture_on_commit_callbacks, published, page):
    with django_capture_on_commit_callbacks(execute=True):
        with pytest.raises(RuntimeError), transaction.atomic():
            page.access = Page.PRIVATE_ACCESS
            page.save()
            raise RuntimeError

    assert published() == []


def test_publish_failure_does_not_break_the_request(django_capture_on_commit_callbacks, page):
    redis = mock.Mock()
    redis.publish.side_effect = ConnectionError("down")
    with mock.patch.object(live_access, "_redis", return_value=redis):
        with django_capture_on_commit_callbacks(execute=True):
            page.is_locked = True
            page.save()

    redis.publish.assert_called_once()


@pytest.mark.parametrize(
    "fields",
    [
        {"is_locked": True},
        {"access": Page.PRIVATE_ACCESS},
        {"archived_at": timezone.now().date()},
        {"deleted_at": timezone.now()},
    ],
)
def test_page_access_inputs_publish_the_page(django_capture_on_commit_callbacks, published, page, fields):
    with django_capture_on_commit_callbacks(execute=True):
        for name, value in fields.items():
            setattr(page, name, value)
        page.save()

    assert published() == [{"page": str(page.id)}]


def test_page_owner_change_publishes_the_page(django_capture_on_commit_callbacks, published, page, member):
    with django_capture_on_commit_callbacks(execute=True):
        page.owned_by = member
        page.save()

    assert published() == [{"page": str(page.id)}]


def test_content_saves_and_new_pages_publish_nothing(
    django_capture_on_commit_callbacks, published, workspace, project, create_user
):
    with django_capture_on_commit_callbacks(execute=True):
        page = make_page(workspace, project, create_user)
        page.description_html = "<p>edited</p>"
        page.name = "Renamed"
        page.save()

    assert published() == []


def test_lock_endpoint_publishes(
    django_capture_on_commit_callbacks, published, session_client, workspace, project, page
):
    with django_capture_on_commit_callbacks(execute=True):
        response = session_client.post(page_url(workspace, project, page, "lock"))

    assert response.status_code == 204
    assert published() == [{"page": str(page.id)}]


def test_archive_publishes_the_page_and_its_descendants(
    django_capture_on_commit_callbacks, published, session_client, workspace, project, page, create_user
):
    child = make_page(workspace, project, create_user, parent=page)

    with django_capture_on_commit_callbacks(execute=True):
        response = session_client.post(page_url(workspace, project, page, "archive"))

    assert response.status_code == 200
    assert sorted(event["page"] for event in published()) == sorted([str(page.id), str(child.id)])


def test_unlinking_a_page_from_the_project_publishes_the_page(django_capture_on_commit_callbacks, published, page):
    with django_capture_on_commit_callbacks(execute=True):
        ProjectPage.objects.get(page=page).delete()

    assert {"page": str(page.id)} in published()


@pytest.mark.parametrize("change", [{"role": GUEST}, {"is_active": False}])
def test_project_member_change_publishes_project_and_user(
    django_capture_on_commit_callbacks, published, project, member, change
):
    project_member = ProjectMember.objects.get(project=project, member=member)

    with django_capture_on_commit_callbacks(execute=True):
        for name, value in change.items():
            setattr(project_member, name, value)
        project_member.save()

    assert published() == [{"project": str(project.id), "user": str(member.id)}]


def test_project_member_removal_publishes(django_capture_on_commit_callbacks, published, project, member):
    with django_capture_on_commit_callbacks(execute=True):
        ProjectMember.objects.get(project=project, member=member).delete()

    assert {"project": str(project.id), "user": str(member.id)} in published()


def test_project_member_preferences_publish_nothing(django_capture_on_commit_callbacks, published, project, member):
    project_member = ProjectMember.objects.get(project=project, member=member)

    with django_capture_on_commit_callbacks(execute=True):
        project_member.sort_order = 10
        project_member.save()

    assert published() == []


def test_bulk_role_update_publishes_each_member(
    django_capture_on_commit_callbacks, published, session_client, workspace, project, member
):
    WorkspaceMember.objects.filter(workspace=workspace, member=member).update(role=GUEST)

    with django_capture_on_commit_callbacks(execute=True):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/members/",
            {"members": [{"member_id": str(member.id), "role": GUEST}]},
            format="json",
        )

    assert response.status_code == 201
    assert {"project": str(project.id), "user": str(member.id)} in published()


def test_workspace_member_deactivation_publishes_the_user(
    django_capture_on_commit_callbacks, published, workspace, member
):
    workspace_member = WorkspaceMember.objects.get(workspace=workspace, member=member)

    with django_capture_on_commit_callbacks(execute=True):
        workspace_member.is_active = False
        workspace_member.save()

    assert published() == [{"user": str(member.id)}]


def test_user_deactivation_publishes_the_user(django_capture_on_commit_callbacks, published, member):
    with django_capture_on_commit_callbacks(execute=True):
        member.is_active = False
        member.save()

    assert published() == [{"user": str(member.id)}]


def test_guest_visibility_change_publishes_the_project(django_capture_on_commit_callbacks, published, project):
    with django_capture_on_commit_callbacks(execute=True):
        project.guest_view_all_features = True
        project.save()
        project.timezone = "Europe/Berlin"
        project.save()

    assert published() == [{"project": str(project.id)}]


def test_project_deletion_publishes_the_project(django_capture_on_commit_callbacks, published, project):
    with django_capture_on_commit_callbacks(execute=True):
        project.deleted_at = timezone.now()
        project.save()

    assert published() == [{"project": str(project.id)}]


def test_deleted_project_denies_live_access_before_the_cascade(workspace, project, member, page):
    client = APIClient()
    client.force_authenticate(user=member)
    assert client.get(page_url(workspace, project, page, "live-access")).data == {"access": "edit"}

    # Only the project row, as the membership and page link cascade runs later in a task.
    Project.objects.filter(pk=project.pk).update(deleted_at=timezone.now())

    assert client.get(page_url(workspace, project, page, "live-access")).status_code == 403


def test_workspace_demotion_to_guest_publishes_the_user(
    django_capture_on_commit_callbacks, published, session_client, workspace, member
):
    workspace_member = WorkspaceMember.objects.get(workspace=workspace, member=member)

    with django_capture_on_commit_callbacks(execute=True):
        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/members/{workspace_member.id}/", {"role": GUEST}, format="json"
        )

    assert response.status_code == 200
    assert ProjectMember.objects.get(member=member).role == GUEST
    assert published() == [{"user": str(member.id)}]


def test_member_command_role_change_publishes(django_capture_on_commit_callbacks, published, project, member):
    with django_capture_on_commit_callbacks(execute=True):
        call_command(
            "create_project_member", project_id=str(project.id), user_email=member.email, role=GUEST, stdout=StringIO()
        )

    assert ProjectMember.objects.get(project=project, member=member).role == GUEST
    assert published() == [{"project": str(project.id), "user": str(member.id)}]
