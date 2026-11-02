# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import redis
from django.conf import settings


def redis_instance(**options):
    # connect to redis
    if settings.REDIS_SSL and settings.REDIS_URL and settings.REDIS_URL.startswith("rediss://"):
        # Use the same URL parsing for TLS credentials, database and query options.
        ri = redis.Redis.from_url(settings.REDIS_URL, db=0, **settings.REDIS_SSL_KWARGS, **options)
    else:
        # db=0 is only the default: a database in the URL wins, so tests can vary it per worker.
        ri = redis.Redis.from_url(settings.REDIS_URL, db=0, **options)

    return ri
