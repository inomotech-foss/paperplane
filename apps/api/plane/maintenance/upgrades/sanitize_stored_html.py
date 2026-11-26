# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging

from django.db.models import Model

from plane.maintenance.upgrade import Batch, DataUpgrade, JsonValue, keyset_batch, step_through
from plane.utils.content_validator import validate_html_content
from plane.utils.stored_html import TARGETS, StoredHtml

logger = logging.getLogger("plane.maintenance")

# Stored HTML can be megabytes per row, so a batch holds only a few rows.
BATCH_SIZE = 10


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


def _sanitize_batch(name: str, target: StoredHtml, after: str | None) -> tuple[str | None, dict[str, int]]:
    rows, after = keyset_batch(target.rows(), after, BATCH_SIZE)
    counts = {"scanned": len(rows), "changed": 0, "skipped": 0, "failed": 0}
    for row in rows:
        _sanitize(name, target, row, counts)
    return after, counts


def step(cursor: JsonValue) -> Batch:
    return step_through(TARGETS, cursor, _sanitize_batch)


UPGRADE = DataUpgrade(
    name="2026_11_sanitize_stored_html",
    description="Sanitize user HTML in pages, work items, comments, versions and automation templates "
    "that was stored before it was sanitized on save.",
    step=step,
)
