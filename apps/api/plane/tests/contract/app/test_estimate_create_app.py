# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import Estimate, Project, ProjectMember


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.mark.contract
@pytest.mark.django_db
class TestEstimateCreate:
    def url(self, workspace, project):
        return f"/api/workspaces/{workspace.slug}/projects/{project.id}/estimates/"

    def test_missing_estimate_returns_400(self, session_client, workspace, project):
        response = session_client.post(
            self.url(workspace, project), {"estimate_points": [{"key": 1, "value": "1"}]}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "estimate" in response.data
        assert not Estimate.objects.filter(project=project).exists()

    def test_invalid_points_create_no_estimate(self, session_client, workspace, project):
        response = session_client.post(
            self.url(workspace, project),
            {"estimate": {"name": "E"}, "estimate_points": [{"key": 1, "value": "x" * 21}]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not Estimate.objects.filter(project=project).exists()

    def test_create(self, session_client, workspace, project):
        response = session_client.post(
            self.url(workspace, project),
            {"estimate": {"name": "E", "type": "points"}, "estimate_points": [{"key": 1, "value": "3"}]},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        estimate = Estimate.objects.get(project=project)
        assert estimate.name == "E"
        assert estimate.type == "points"
        assert list(estimate.points.values_list("value", flat=True)) == ["3"]
