# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the workspace's default PQL dialect.

The dialect only picks the query bar's completion and help; the parser accepts both.
Like every workspace setting, only a workspace admin can change it.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.tests.factories import UserFactory, WorkspaceMemberFactory

ADMIN, MEMBER, GUEST = 20, 15, 5


def _client_for(workspace, role):
    user = UserFactory()
    WorkspaceMemberFactory(workspace=workspace, member=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspacePqlDialect:
    def test_workspace_default_dialect_is_jql(self, workspace):
        response = _client_for(workspace, MEMBER).get(f"/api/workspaces/{workspace.slug}/")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["pql_dialect"] == "jql"

    def test_admin_sets_workspace_dialect(self, workspace):
        response = _client_for(workspace, ADMIN).patch(
            f"/api/workspaces/{workspace.slug}/", {"pql_dialect": "plane"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["pql_dialect"] == "plane"
        workspace.refresh_from_db()
        assert workspace.pql_dialect == "plane"

    @pytest.mark.parametrize("role", [MEMBER, GUEST])
    def test_non_admin_cannot_set_workspace_dialect(self, workspace, role):
        response = _client_for(workspace, role).patch(
            f"/api/workspaces/{workspace.slug}/", {"pql_dialect": "plane"}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN, response.data
        workspace.refresh_from_db()
        assert workspace.pql_dialect == "jql"

    @pytest.mark.parametrize("value", ["PQL", ""])
    def test_invalid_workspace_dialect(self, workspace, value):
        response = _client_for(workspace, ADMIN).patch(
            f"/api/workspaces/{workspace.slug}/", {"pql_dialect": value}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST, response.data
        workspace.refresh_from_db()
        assert workspace.pql_dialect == "jql"
