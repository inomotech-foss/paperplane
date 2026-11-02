# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import logging
from functools import cache

from django.db import transaction

from plane.settings.redis import redis_instance

logger = logging.getLogger("plane.api")

# Must match ACCESS_CHANNEL in apps/live/src/lib/access-events.ts
LIVE_ACCESS_CHANNEL = "paperplane:live-access"


def notify_live_access_changed(*, page=None, project=None, user=None):
    """Ask every live server to re-check the open page sessions that match all given ids.

    The event only triggers a re-check against the API, so it never grants access.
    """
    scope = {key: str(value) for key, value in (("page", page), ("project", project), ("user", user)) if value}
    if scope:
        transaction.on_commit(lambda: _publish(scope))


@cache
def _redis():
    # A hung Redis must not hold up the response that published the event.
    return redis_instance(socket_timeout=2, socket_connect_timeout=2)


def _publish(scope):
    try:
        _redis().publish(LIVE_ACCESS_CHANNEL, json.dumps(scope))
    except Exception:
        logger.exception("Could not notify live servers of an access change")
