# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import importlib

import pytest
from django.apps import apps

from plane.license.models import InstanceConfiguration
from plane.license.utils.encryption import decrypt_data, encrypt_data

migration = importlib.import_module("plane.license.migrations.0007_shared_ms365_and_email_transport")


@pytest.mark.unit
@pytest.mark.django_db
class TestSharedMs365Keys:
    def test_renames_service_desk_keys(self):
        InstanceConfiguration.objects.create(
            key="SERVICE_DESK_MS365_TENANT_ID", value="tenant", category="SERVICE_DESK"
        )
        InstanceConfiguration.objects.create(
            key="SERVICE_DESK_MS365_CLIENT_SECRET",
            value=encrypt_data("secret"),
            category="SERVICE_DESK",
            is_encrypted=True,
        )
        InstanceConfiguration.objects.create(key="ENABLE_SMTP", value="1", category="SMTP")

        migration.share_ms365_credentials(apps, None)

        keys = set(InstanceConfiguration.objects.values_list("key", flat=True))
        assert keys == {"MS365_TENANT_ID", "MS365_CLIENT_SECRET"}
        tenant = InstanceConfiguration.objects.get(key="MS365_TENANT_ID")
        assert (tenant.value, tenant.category) == ("tenant", "MS365")
        secret = InstanceConfiguration.objects.get(key="MS365_CLIENT_SECRET")
        assert secret.is_encrypted
        assert decrypt_data(secret.value) == "secret"

    def test_fills_empty_new_key_from_old_key(self):
        InstanceConfiguration.objects.create(key="SERVICE_DESK_MS365_CLIENT_ID", value="old", category="SERVICE_DESK")
        InstanceConfiguration.objects.create(key="MS365_CLIENT_ID", value="", category="MS365")

        migration.share_ms365_credentials(apps, None)

        assert list(InstanceConfiguration.objects.values_list("key", "value")) == [("MS365_CLIENT_ID", "old")]

    def test_keeps_existing_new_value(self):
        InstanceConfiguration.objects.create(key="SERVICE_DESK_MS365_CLIENT_ID", value="old", category="SERVICE_DESK")
        InstanceConfiguration.objects.create(key="MS365_CLIENT_ID", value="new", category="MS365")

        migration.share_ms365_credentials(apps, None)

        assert list(InstanceConfiguration.objects.values_list("key", "value")) == [("MS365_CLIENT_ID", "new")]
