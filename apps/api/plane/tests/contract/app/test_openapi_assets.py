# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The asset endpoints document the bodies and query params they read."""

from unittest.mock import patch

import jsonschema
import pytest

from plane.db.models import FileAsset, ProjectMember
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented_query, documented_request

WORKSPACE = "/api/assets/v2/workspaces/{slug}/"
PROJECT = WORKSPACE + "projects/{project_id}/"
UPLOAD = {"name": "a.png", "type": "image/png", "size": 10, "entity_type": "ISSUE_DESCRIPTION", "entity_identifier": ""}


@pytest.mark.contract
@pytest.mark.parametrize(
    "route",
    [WORKSPACE, PROJECT, "/api/assets/v2/user-assets/", "/api/public/assets/v2/anchor/{anchor}/"],
)
def test_upload_bodies(route):
    documented_request(route, "post", UPLOAD)
    with pytest.raises(jsonschema.ValidationError):
        documented_request(route, "post", {**UPLOAD, "entity_type": "NOPE"})


@pytest.mark.contract
def test_other_bodies():
    documented_request(WORKSPACE + "{asset_id}/", "patch", {"attributes": {"width": 10}})
    documented_request(PROJECT + "{entity_id}/bulk/", "post", {"asset_ids": ["8a1e2b9c-6f0d-4e3a-9b1c-2d3e4f5a6b7c"]})
    documented_request(
        WORKSPACE + "duplicate-assets/{asset_id}/", "post", {"entity_type": "PAGE_DESCRIPTION", "project_id": None}
    )
    with pytest.raises(jsonschema.ValidationError):
        documented_request(PROJECT + "{entity_id}/bulk/", "post", {"asset_ids": "a"})
    assert documented_query("/api/unsplash/", "get") == {"query", "page", "per_page"}


@pytest.mark.contract
@pytest.mark.django_db
def test_bulk_and_attributes(session_client, create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="AS")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    asset = FileAsset.objects.create(
        workspace=workspace,
        project=project,
        asset="w/a.png",
        attributes={},
        entity_type="ISSUE_DESCRIPTION",
        created_by=create_user,
    )
    url = PROJECT.format(slug=workspace.slug, project_id=project.id)
    with patch("plane.app.views.asset.v2.get_asset_object_metadata"):
        assert session_client.patch(f"{url}{asset.id}/", {"attributes": {"w": 1}}, format="json").status_code == 204
    asset.refresh_from_db()
    assert asset.attributes == {"w": 1}
