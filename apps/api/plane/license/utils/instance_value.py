# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os

# Django imports
from django.conf import settings

# Module imports
from plane.license.models import InstanceConfiguration
from plane.license.utils.encryption import decrypt_data


def get_managed_configuration_keys():
    """Keys the Helm chart reconciles (PROVISION_MANAGED_KEYS). These are owned
    by the deploy, so the god-mode UI shows them read-only and edits are ignored.
    """
    raw = os.environ.get("PROVISION_MANAGED_KEYS", "")
    return {key.strip() for key in raw.split(",") if key.strip()}


# Helper function to return value from the passed key. With decrypt=False,
# encrypted values come back as ciphertext, which is enough for presence checks.
def get_configuration_value(keys, decrypt=True):
    environment_list = []
    if settings.SKIP_ENV_VAR:
        # Get the configurations
        instance_configuration = InstanceConfiguration.objects.values("key", "value", "is_encrypted")

        for key in keys:
            for item in instance_configuration:
                if key.get("key") == item.get("key"):
                    if decrypt and item.get("is_encrypted", False):
                        environment_list.append(decrypt_data(item.get("value")))
                    else:
                        environment_list.append(item.get("value"))

                    break
            else:
                environment_list.append(key.get("default"))
    else:
        # Get the configuration from os
        for key in keys:
            environment_list.append(os.environ.get(key.get("key"), key.get("default")))

    return tuple(environment_list)


def get_ms365_configuration(decrypt=True):
    """Tenant ID, client ID and client secret of the Microsoft 365 app registration."""
    return get_configuration_value(
        [
            {"key": "MS365_TENANT_ID", "default": os.environ.get("MS365_TENANT_ID")},
            {"key": "MS365_CLIENT_ID", "default": os.environ.get("MS365_CLIENT_ID")},
            {"key": "MS365_CLIENT_SECRET", "default": os.environ.get("MS365_CLIENT_SECRET")},
        ],
        decrypt=decrypt,
    )
