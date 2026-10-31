# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The project, cycle, module and view favorite lists return the user's favorites of that kind."""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from plane.db.models import Cycle, IssueView, Module, ProjectMember, UserFavorite
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="FAV")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture
def favorites(create_user, workspace, project):
    other = ProjectFactory(workspace=workspace, identifier="OTH")
    ProjectMember.objects.create(project=other, member=create_user, role=20)
    entities = {
        "cycle": Cycle.objects.create(name="C", project=project, workspace=workspace, owned_by=create_user),
        "module": Module.objects.create(name="M", project=project, workspace=workspace),
        "view": IssueView.objects.create(name="V", project=project, workspace=workspace, owned_by=create_user),
        "project": project,
    }
    for entity_type, entity in entities.items():
        UserFavorite.objects.create(
            user=create_user,
            workspace=workspace,
            project=project,
            entity_type=entity_type,
            entity_identifier=entity.id,
        )
    UserFavorite.objects.create(
        user=create_user,
        workspace=workspace,
        project=other,
        entity_type="cycle",
        entity_identifier=Cycle.objects.create(name="O", project=other, workspace=workspace, owned_by=create_user).id,
    )
    return entities


@pytest.mark.contract
@pytest.mark.django_db
class TestUserFavoriteLists:
    @pytest.mark.parametrize("entity_type", ["cycle", "module", "view"])
    def test_project_entity_favorites(self, session_client, workspace, project, favorites, entity_type):
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/user-favorite-{entity_type}s/"
        listed = documented(session_client.get(url))
        assert [(row["entity_type"], row["entity_identifier"]) for row in listed] == [
            (entity_type, str(favorites[entity_type].id))
        ]
        assert listed[0]["entity_data"]["name"] == favorites[entity_type].name

    def test_project_favorites(self, session_client, workspace, project, favorites):
        listed = documented(session_client.get(f"/api/workspaces/{workspace.slug}/user-favorite-projects/"))
        assert [row["entity_identifier"] for row in listed] == [str(project.id)]

    def test_inactive_member_sees_no_favorites(self, session_client, create_user, workspace, project, favorites):
        ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
        listed = documented(session_client.get(f"/api/workspaces/{workspace.slug}/user-favorite-projects/"))
        assert listed == []

    def test_soft_deleted_member_sees_no_favorites(self, session_client, create_user, workspace, project, favorites):
        ProjectMember.objects.filter(project=project, member=create_user).update(deleted_at=timezone.now())
        listed = documented(session_client.get(f"/api/workspaces/{workspace.slug}/user-favorite-projects/"))
        assert listed == []

    def test_entity_data_does_not_query_per_row(self, session_client, create_user, workspace, project, favorites):
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/user-favorite-cycles/"
        session_client.get(url)
        with CaptureQueriesContext(connection) as one:
            assert len(session_client.get(url).json()) == 1
        for name in ("D", "E", "F"):
            cycle = Cycle.objects.create(name=name, project=project, workspace=workspace, owned_by=create_user)
            UserFavorite.objects.create(
                user=create_user, workspace=workspace, project=project, entity_type="cycle", entity_identifier=cycle.id
            )
        with CaptureQueriesContext(connection) as four:
            listed = session_client.get(url).json()
        assert len(listed) == 4 and all(row["entity_data"] for row in listed)
        assert len(four.captured_queries) == len(one.captured_queries)
