# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Cycle, module link and page writes ignore the fields the server owns."""

import pytest
from django.utils import timezone

from plane.db.models import Cycle, Module, ModuleLink, Page, ProjectMember, ProjectPage, User
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import no_tasks  # noqa: F401


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="RO")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


def url(project, path):
    return f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/{path}"


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestReadOnlyFields:
    def test_cycle(self, session_client, create_user, project):
        cycle = Cycle.objects.create(name="C", project=project, workspace=project.workspace, owned_by=create_user)
        body = {"name": "N", "deleted_at": timezone.now().isoformat(), "version": 2, "progress_snapshot": {"x": 1}}
        assert session_client.patch(url(project, f"cycles/{cycle.id}/"), body, format="json").status_code == 200
        cycle = Cycle.all_objects.get(pk=cycle.pk)
        assert (cycle.name, cycle.deleted_at, cycle.version, cycle.progress_snapshot) == ("N", None, 1, {})

    def test_module_link(self, session_client, project):
        module = Module.objects.create(name="M", project=project, workspace=project.workspace)
        link = ModuleLink.objects.create(
            module=module, url="https://a.test", project=project, workspace=project.workspace
        )
        body = {"title": "T", "url": "https://a.test", "deleted_at": timezone.now().isoformat()}
        path = url(project, f"modules/{module.id}/module-links/{link.id}/")
        response = session_client.patch(path, body, format="json")
        assert response.status_code == 200, response.content
        link = ModuleLink.all_objects.get(pk=link.pk)
        assert (link.title, link.deleted_at) == ("T", None)

    def test_page_update(self, session_client, create_user, project):
        page = Page.objects.create(name="P", owned_by=create_user, workspace=project.workspace)
        ProjectPage.objects.create(project=project, page=page, workspace=project.workspace)
        creator = page.created_by_id
        other = User.objects.create(email="other@plane.so", username="other")
        body = {"name": "N", "archived_at": "2026-01-01", "created_by": str(other.id)}
        assert session_client.patch(url(project, f"pages/{page.id}/"), body, format="json").status_code == 200
        page.refresh_from_db()
        assert (page.name, page.archived_at, page.created_by_id) == ("N", None, creator)

    def test_page_create_ignores_id_lists(self, session_client, project):
        body = {"name": "P", "label_ids": [], "project_ids": [str(project.id)], "archived_at": "2026-01-01"}
        response = session_client.post(url(project, "pages/"), body, format="json")
        assert response.status_code == 201, response.content
        assert Page.objects.get(pk=response.json()["id"]).archived_at is None
