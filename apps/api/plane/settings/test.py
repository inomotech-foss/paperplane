# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Test Settings"""

import os
from urllib.parse import urlparse, urlunparse

from .common import *  # noqa

DEBUG = True

# Every test clears the cache, so workers need separate Redis databases.
_worker = os.environ.get("PYTEST_XDIST_WORKER")
if _worker and REDIS_URL:  # noqa: F405
    # Redis serves 16 databases.
    _database = int(_worker.removeprefix("gw")) % 16
    REDIS_URL = urlunparse(urlparse(REDIS_URL)._replace(path=f"/{_database}"))  # noqa: F405
    CACHES["default"]["LOCATION"] = REDIS_URL  # noqa: F405

# Send it in a dummy outbox
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

INSTALLED_APPS.append(  # noqa
    "plane.tests"
)
