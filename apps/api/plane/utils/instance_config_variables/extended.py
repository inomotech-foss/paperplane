# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

service_desk_config_variables = [
    {
        "key": "SERVICE_DESK_MS365_TENANT_ID",
        "value": os.environ.get("SERVICE_DESK_MS365_TENANT_ID"),
        "category": "SERVICE_DESK",
        "is_encrypted": False,
    },
    {
        "key": "SERVICE_DESK_MS365_CLIENT_ID",
        "value": os.environ.get("SERVICE_DESK_MS365_CLIENT_ID"),
        "category": "SERVICE_DESK",
        "is_encrypted": False,
    },
    {
        "key": "SERVICE_DESK_MS365_CLIENT_SECRET",
        "value": os.environ.get("SERVICE_DESK_MS365_CLIENT_SECRET"),
        "category": "SERVICE_DESK",
        "is_encrypted": True,
    },
]

extended_config_variables = [*service_desk_config_variables]
