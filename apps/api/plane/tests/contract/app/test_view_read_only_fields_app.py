# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""A view update cannot soft-delete or archive the view."""

import pytest

from plane.db.models import IssueView


@pytest.mark.contract
@pytest.mark.django_db
def test_patch_keeps_server_owned_fields(session_client, create_user, workspace):
    view = IssueView.objects.create(name="V", workspace=workspace, owned_by=create_user)
    IssueView.objects.filter(pk=view.pk).update(created_by=create_user)
    body = {"name": "N", "deleted_at": "2030-01-01T00:00:00Z", "archived_at": "2030-01-01T00:00:00Z"}
    response = session_client.patch(f"/api/workspaces/{workspace.slug}/views/{view.id}/", body, format="json")
    assert response.status_code == 200
    view = IssueView.all_objects.get(pk=view.id)
    assert view.name == "N"
    assert view.deleted_at is None
    assert view.archived_at is None
