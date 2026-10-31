# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""An instance update changes only the settings an admin edits."""

import pytest

from plane.license.models import Instance


@pytest.mark.contract
@pytest.mark.django_db
def test_patch_keeps_server_owned_fields(instance_admin_client):
    body = {"instance_name": "Renamed", "is_verified": True, "instance_id": "forged", "latest_version": "99"}
    assert instance_admin_client.patch("/api/instances/", body, format="json").status_code == 200
    instance = Instance.objects.get()
    assert instance.instance_name == "Renamed"
    assert instance.is_verified is False
    assert instance.instance_id == "test"
    assert instance.latest_version == "1"
