# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

# App registration shared by outgoing email (Mail.Send) and the service desk
# (Mail.ReadWrite).
ms365_config_variables = [
    {
        "key": "MS365_TENANT_ID",
        "value": os.environ.get("MS365_TENANT_ID"),
        "category": "MS365",
        "is_encrypted": False,
    },
    {
        "key": "MS365_CLIENT_ID",
        "value": os.environ.get("MS365_CLIENT_ID"),
        "category": "MS365",
        "is_encrypted": False,
    },
    {
        "key": "MS365_CLIENT_SECRET",
        "value": os.environ.get("MS365_CLIENT_SECRET"),
        "category": "MS365",
        "is_encrypted": True,
    },
]

service_desk_config_variables = [
    {
        # Full URL Graph pushes change notifications to, defaults to
        # <WEB_URL>/api/service-desk/webhook/ when WEB_URL is https.
        "key": "SERVICE_DESK_WEBHOOK_URL",
        "value": os.environ.get("SERVICE_DESK_WEBHOOK_URL"),
        "category": "SERVICE_DESK",
        "is_encrypted": False,
    },
]

extended_config_variables = [*ms365_config_variables, *service_desk_config_variables]
