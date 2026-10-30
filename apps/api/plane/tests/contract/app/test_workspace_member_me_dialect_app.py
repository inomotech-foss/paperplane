# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for a member's own PQL dialect on ``workspace-members/me/``.

Every member may pick their own dialect, or clear it to follow the workspace's,
but the endpoint writes nothing else: a role or any other key is refused.
"""

import json

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.management.commands.generate_openapi import generate_schema
from plane.db.models import WorkspaceMember
from plane.tests.factories import UserFactory, WorkspaceMemberFactory

ADMIN, MEMBER, GUEST = 20, 15, 5


def _member(workspace, role, **kwargs):
    user = UserFactory()
    member = WorkspaceMemberFactory(workspace=workspace, member=user, role=role, **kwargs)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, member


def _url(workspace):
    return f"/api/workspaces/{workspace.slug}/workspace-members/me/"


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceMemberDialect:
    def test_me_reports_no_dialect_by_default(self, workspace):
        client, _ = _member(workspace, MEMBER)
        response = client.get(_url(workspace))
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["pql_dialect"] is None

    @pytest.mark.parametrize("role", [ADMIN, MEMBER, GUEST])
    def test_member_sets_own_dialect(self, workspace, role):
        client, member = _member(workspace, role)
        response = client.patch(_url(workspace), {"pql_dialect": "plane"}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["pql_dialect"] == "plane"
        assert response.data["draft_issue_count"] == 0
        member.refresh_from_db()
        assert member.pql_dialect == "plane"

    def test_member_clears_own_dialect(self, workspace):
        client, member = _member(workspace, MEMBER, pql_dialect="plane")
        response = client.patch(_url(workspace), {"pql_dialect": None}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        member.refresh_from_db()
        assert member.pql_dialect is None

    def test_member_dialect_rejects_other_keys(self, workspace):
        client, member = _member(workspace, GUEST)
        response = client.patch(_url(workspace), {"pql_dialect": "plane", "role": ADMIN}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST, response.data
        member.refresh_from_db()
        assert member.role == GUEST
        assert member.pql_dialect is None

    @pytest.mark.parametrize("value", ["PQL", ""])
    def test_member_dialect_invalid_value(self, workspace, value):
        client, member = _member(workspace, MEMBER)
        response = client.patch(_url(workspace), {"pql_dialect": value}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST, response.data
        member.refresh_from_db()
        assert member.pql_dialect is None

    def test_member_dialect_only_touches_own_row(self, workspace):
        client, _ = _member(workspace, MEMBER)
        _, other = _member(workspace, MEMBER)
        response = client.patch(_url(workspace), {"pql_dialect": "plane"}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        other.refresh_from_db()
        assert other.pql_dialect is None
        assert WorkspaceMember.objects.filter(workspace=workspace, pql_dialect="plane").count() == 1

    def test_inactive_member_cannot_set_dialect(self, workspace):
        client, member = _member(workspace, MEMBER, is_active=False)
        response = client.patch(_url(workspace), {"pql_dialect": "plane"}, format="json")
        assert response.status_code != status.HTTP_200_OK
        member.refresh_from_db()
        assert member.pql_dialect is None


@pytest.mark.contract
class TestWorkspaceMemberDialectSchema:
    def test_patch_documents_its_request_and_response(self):
        schema, _ = generate_schema("internal")
        patch = schema["paths"]["/api/workspaces/{slug}/workspace-members/me/"]["patch"]
        request_ref = patch["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        request_schema = schema["components"]["schemas"][request_ref.rsplit("/", 1)[1]]
        assert set(request_schema["properties"]) == {"pql_dialect"}
        assert patch["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("/WorkspaceMemberMe")
        assert "400" in patch["responses"]

    def test_blank_is_not_a_member_dialect(self):
        # A blank string is not a dialect; null is how a member follows the workspace.
        assert WorkspaceMember._meta.get_field("pql_dialect").blank is False
        schema, _ = generate_schema("internal")
        assert "BlankEnum" not in json.dumps(schema["components"]["schemas"]["WorkspaceMemberMe"])
