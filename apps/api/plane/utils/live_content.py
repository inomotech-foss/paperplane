# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import logging
import uuid
from functools import cache

from django.db import transaction

from plane.settings.redis import redis_instance

logger = logging.getLogger("plane.api")

# Must match CONTENT_CHANNEL in apps/live/src/lib/content-events.ts
LIVE_CONTENT_CHANNEL = "paperplane:live-content"


def notify_live_content_replaced(*, page, description_html):
    """Hand a page body written outside the editor to the live servers.

    A live server holding the page open applies the HTML to its document, so
    the people editing see it and its next save keeps it. Without this the
    open document still holds the old body and saves it back over the new one.
    The event id lets exactly one server apply it when several hold the page.
    """
    event = {"id": uuid.uuid4().hex, "page": str(page), "html": description_html or "<p></p>"}
    transaction.on_commit(lambda: _publish(event))


@cache
def _redis():
    # A hung Redis must not hold up the response that published the event.
    return redis_instance(socket_timeout=2, socket_connect_timeout=2)


def _publish(event):
    try:
        _redis().publish(LIVE_CONTENT_CHANNEL, json.dumps(event))
    except Exception:
        logger.exception("Could not hand a page body to the live servers")
