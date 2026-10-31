# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The timezone list offers only zones the models accept."""

import pytest
import pytz
from django.core.cache import cache


@pytest.mark.contract
@pytest.mark.django_db
def test_offers_only_common_timezones(api_client):
    cache.clear()
    response = api_client.get("/api/timezones/")
    assert response.status_code == 200
    values = {tz["value"] for tz in response.json()["timezones"]}
    assert values <= set(pytz.common_timezones)
    assert "America/Nuuk" in values
