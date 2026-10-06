# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Project, ProjectUserProperty


@pytest.mark.contract
@pytest.mark.django_db
class TestJoinProjectsSortOrder:
    def test_joined_projects_get_distinct_alphabetical_sort_orders(self, workspace, create_user):
        projects = [
            Project.objects.create(name=name, identifier=name[:3].upper(), workspace=workspace)
            for name in ["cherry", "Apple", "banana"]
        ]
        client = APIClient()
        client.force_authenticate(user=create_user)

        response = client.post(
            f"/api/users/me/workspaces/{workspace.slug}/projects/invitations/",
            {"project_ids": [str(p.id) for p in projects]},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        props = ProjectUserProperty.objects.filter(user=create_user, workspace=workspace).select_related("project")
        by_order = [p.project.name for p in sorted(props, key=lambda p: p.sort_order)]
        assert by_order == ["Apple", "banana", "cherry"]
        assert len({p.sort_order for p in props}) == 3
