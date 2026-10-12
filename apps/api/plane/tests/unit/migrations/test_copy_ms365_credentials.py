# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import importlib

import pytest
from django.apps import apps

from plane.license.models import InstanceConfiguration
from plane.license.utils.encryption import decrypt_data, encrypt_data

migration = importlib.import_module("plane.license.migrations.0007_copy_ms365_credentials")


def values():
    return dict(InstanceConfiguration.objects.values_list("key", "value"))


@pytest.mark.unit
@pytest.mark.django_db
class TestCopyMs365Credentials:
    def test_copies_and_keeps_the_old_keys(self):
        InstanceConfiguration.objects.create(
            key="SERVICE_DESK_MS365_TENANT_ID", value="tenant", category="SERVICE_DESK"
        )
        InstanceConfiguration.objects.create(
            key="SERVICE_DESK_MS365_CLIENT_SECRET",
            value=encrypt_data("secret"),
            category="SERVICE_DESK",
            is_encrypted=True,
        )

        migration.copy_ms365_credentials(apps, None)

        assert values()["SERVICE_DESK_MS365_TENANT_ID"] == "tenant"
        tenant = InstanceConfiguration.objects.get(key="MS365_TENANT_ID")
        assert (tenant.value, tenant.category) == ("tenant", "MS365")
        secret = InstanceConfiguration.objects.get(key="MS365_CLIENT_SECRET")
        assert secret.is_encrypted
        assert decrypt_data(secret.value) == "secret"
        assert InstanceConfiguration.objects.filter(key="SERVICE_DESK_MS365_CLIENT_SECRET").exists()

    def test_fills_an_empty_new_key(self):
        InstanceConfiguration.objects.create(key="SERVICE_DESK_MS365_CLIENT_ID", value="old", category="SERVICE_DESK")
        InstanceConfiguration.objects.create(key="MS365_CLIENT_ID", value="", category="MS365")

        migration.copy_ms365_credentials(apps, None)

        assert values()["MS365_CLIENT_ID"] == "old"

    def test_keeps_an_existing_new_value(self):
        InstanceConfiguration.objects.create(key="SERVICE_DESK_MS365_CLIENT_ID", value="old", category="SERVICE_DESK")
        InstanceConfiguration.objects.create(key="MS365_CLIENT_ID", value="new", category="MS365")

        migration.copy_ms365_credentials(apps, None)

        assert values()["MS365_CLIENT_ID"] == "new"

    def test_skips_empty_old_values(self):
        InstanceConfiguration.objects.create(key="SERVICE_DESK_MS365_CLIENT_ID", value="", category="SERVICE_DESK")

        migration.copy_ms365_credentials(apps, None)

        assert "MS365_CLIENT_ID" not in values()

    def test_runs_twice(self):
        InstanceConfiguration.objects.create(key="SERVICE_DESK_MS365_CLIENT_ID", value="old", category="SERVICE_DESK")

        migration.copy_ms365_credentials(apps, None)
        migration.copy_ms365_credentials(apps, None)

        assert InstanceConfiguration.objects.filter(key="MS365_CLIENT_ID").count() == 1
