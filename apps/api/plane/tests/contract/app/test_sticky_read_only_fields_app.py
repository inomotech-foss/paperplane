# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""A sticky update cannot change the fields the server owns."""

import pytest

from plane.db.models import Sticky


@pytest.mark.contract
@pytest.mark.django_db
def test_update_keeps_server_owned_fields(session_client, create_user, workspace):
    sticky = Sticky.objects.create(workspace=workspace, owner=create_user, description_html="<p>a</p>")
    Sticky.objects.filter(pk=sticky.pk).update(created_by=create_user)
    body = {"name": "n", "description_stripped": "x", "deleted_at": "2030-01-01T00:00:00Z", "created_by": None}
    response = session_client.patch(f"/api/workspaces/{workspace.slug}/stickies/{sticky.id}/", body, format="json")
    assert response.status_code == 200
    sticky = Sticky.all_objects.get(pk=sticky.id)
    assert sticky.name == "n"
    assert sticky.deleted_at is None
    assert sticky.description_stripped == "a"
    assert sticky.created_by_id == create_user.id
