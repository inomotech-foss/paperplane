# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging

from django.db.models import Model

from plane.maintenance.upgrade import Batch, DataUpgrade, JsonValue, keyset_batch
from plane.utils.content_validator import validate_html_content
from plane.utils.stored_html import TARGETS, StoredHtml

logger = logging.getLogger("plane.maintenance")

# Stored HTML can be megabytes per row, so a batch holds only a few rows.
BATCH_SIZE = 10

NAMES = list(TARGETS)


def _position(cursor: JsonValue) -> tuple[str, str | None]:
    if cursor is None:
        return NAMES[0], None
    if isinstance(cursor, dict):
        target, after = cursor.get("target"), cursor.get("after")
        if target in TARGETS and (after is None or isinstance(after, str)):
            return target, after
    raise ValueError(f"Unexpected cursor {cursor!r}")


def _sanitize(name: str, target: StoredHtml, row: Model, counts: dict[str, int]) -> None:
    html = target.html_of(row)
    if not html:
        return
    is_valid, error, clean = validate_html_content(html)
    if not is_valid:
        counts["failed"] += 1
        logger.warning("Stored HTML of %s %s was rejected: %s", name, row.pk, error)
    elif clean != html:
        counts["changed" if target.write(row, clean) else "skipped"] += 1


def step(cursor: JsonValue) -> Batch:
    name, after = _position(cursor)
    target = TARGETS[name]
    rows, after = keyset_batch(target.rows(), after, BATCH_SIZE)
    counts = {"scanned": len(rows), "changed": 0, "skipped": 0, "failed": 0}
    for row in rows:
        _sanitize(name, target, row, counts)
    if after is not None:
        return Batch(cursor={"target": name, "after": after}, counts=counts)
    following = NAMES.index(name) + 1
    if following == len(NAMES):
        return Batch(cursor=None, counts=counts)
    return Batch(cursor={"target": NAMES[following], "after": None}, counts=counts)


UPGRADE = DataUpgrade(
    name="2026_11_sanitize_stored_html",
    description="Sanitize user HTML in pages, work items, comments, versions and automation templates "
    "that was stored before it was sanitized on save.",
    step=step,
)
