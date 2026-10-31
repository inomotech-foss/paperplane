# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""A webhook update cannot change the fields the server owns."""

import pytest

from plane.db.models import Webhook


@pytest.mark.contract
@pytest.mark.django_db
def test_patch_keeps_server_owned_fields(session_client, create_user, workspace):
    webhook = Webhook.objects.create(workspace=workspace, url="https://example.com/hook")
    body = {"is_active": False, "is_internal": True, "version": "v9", "created_by": str(create_user.id)}
    response = session_client.patch(f"/api/workspaces/{workspace.slug}/webhooks/{webhook.id}/", body, format="json")
    assert response.status_code == 200
    webhook.refresh_from_db()
    assert webhook.is_active is False
    assert webhook.is_internal is False
    assert webhook.version == "v1"
    assert webhook.created_by_id is None
