# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Rewrite the tables of pages imported from Confluence before the table normaliser.

The HTML is rewritten the way an import now writes it, and the binary document
and JSON are dropped so the live server rebuilds them from the HTML. A page
whose HTML needs no change but which holds a table and a binary document only
gets its binary dropped: the earlier editor fixed every column it had no width
for at 150px, and that width lives in the binary, not the HTML.

Soft-deleted pages are included, so a page restored later is upgraded too.
Locked pages are included on purpose, unlike in the repair_confluence_pages
command this replaces: only the markup changes and every word stays.
A page with a version in force and no unapproved changes is left alone: any
new markup would show as an unapproved change.
"""

import logging
import uuid
from collections import Counter

from django.db.models import Q, QuerySet
from django.utils import timezone

from plane.db.models import Page, PageApproval, PageVersion
from plane.importers.confluence.loader import ConfluenceLoader
from plane.importers.confluence.repair import repair_page_html
from plane.maintenance.upgrade import Batch, DataUpgrade, JsonValue, keyset_batch
from plane.utils.content_validator import validate_html_content
from plane.utils.html_processor import strip_tags
from plane.utils.live_content import notify_live_content_replaced

logger = logging.getLogger("plane.maintenance")

BATCH_SIZE = 10

SCANNED = "scanned"
REWRITTEN = "rewritten"
REBUILT = "rebuilt"
UNCHANGED = "unchanged"
RACED = "raced"
IN_FORCE = "in_force"
FAILED = "failed"


def _pages() -> QuerySet[Page]:
    pages = Page.all_objects.filter(external_source=ConfluenceLoader.EXTERNAL_SOURCE)
    return pages.defer("description_json", "description_binary")


def _clean(html: str) -> str:
    is_valid, error, clean = validate_html_content(html)
    if not is_valid:
        raise ValueError(error)
    return clean or "<p></p>"


def _with_binary(pages: list[Page]) -> set[uuid.UUID]:
    rows = Page.all_objects.filter(pk__in=[page.id for page in pages], description_binary__isnull=False)
    return set(rows.exclude(description_binary=b"").values_list("pk", flat=True))


def _in_force_html(pages: list[Page]) -> dict[uuid.UUID, str]:
    """The body of each page's version in force: the approved version, else the baseline."""
    rows = (
        PageApproval.all_objects.filter(page_id__in=[page.id for page in pages])
        .filter(Q(approved_version__isnull=False) | Q(baseline_version__isnull=False))
        .values_list(
            "page_id",
            "approved_version_id",
            "approved_version__description_html",
            "baseline_version__description_html",
        )
    )
    return {
        page_id: (approved_html if approved_id else baseline_html) or ""
        for page_id, approved_id, approved_html, baseline_html in rows
    }


def _record_versions(page: Page, old_html: str, new_html: str) -> None:
    """A version for the new body, and one for the body it replaces when the
    page has none, so the old body can always be read back."""
    now = timezone.now()
    common = {
        "workspace_id": page.workspace_id,
        "page_id": page.id,
        "owned_by_id": page.owned_by_id,
        "description_json": {},
        "description_binary": None,
        "sub_pages_data": {},
    }
    if not PageVersion.objects.filter(page_id=page.id).exists():
        PageVersion.objects.create(**common, last_saved_at=page.updated_at or now, description_html=old_html)
    PageVersion.objects.create(**common, last_saved_at=now, description_html=new_html)


def _upgrade_page(page: Page, has_binary: bool, in_force_html: str | None) -> str:
    old_html = page.description_html or ""
    try:
        repair = repair_page_html(old_html)
        if not repair.has_tables:
            return UNCHANGED
        new_html = _clean(repair.html)
        # compare sanitised forms: the parser may re-serialise unchanged markup differently
        changed = new_html != _clean(old_html)
    except Exception:
        logger.exception("Could not normalise the tables of page %s", page.id)
        return FAILED

    if not changed and not has_binary:
        return UNCHANGED
    # Dropping the binary counts too: the live server writes the HTML back as the editor serialises it.
    if in_force_html is not None and old_html == in_force_html:
        return IN_FORCE

    values: dict[str, object] = {"description_binary": None, "description_json": {}}
    if changed:
        values.update(description_html=new_html, description_stripped=strip_tags(new_html))
    written = Page.all_objects.filter(pk=page.pk, description_html=page.description_html).update(**values)
    if not written:
        logger.info("Page %s changed while its tables were normalised, skipped", page.id)
        return RACED
    if changed:
        _record_versions(page, old_html, new_html)
    # an open document would otherwise save its old body (and its fixed widths) back
    notify_live_content_replaced(page=page.id, description_html=new_html if changed else old_html)
    return REWRITTEN if changed else REBUILT


def step(cursor: JsonValue) -> Batch:
    pages, following = keyset_batch(_pages(), cursor if isinstance(cursor, str) else None, BATCH_SIZE)
    with_binary = _with_binary(pages)
    in_force = _in_force_html(pages)
    counts = Counter({key: 0 for key in (SCANNED, REWRITTEN, REBUILT, UNCHANGED, RACED, IN_FORCE, FAILED)})
    counts[SCANNED] = len(pages)
    for page in pages:
        counts[_upgrade_page(page, page.id in with_binary, in_force.get(page.id))] += 1
    return Batch(cursor=following, counts=dict(counts))


UPGRADE = DataUpgrade(
    name="2026_11_normalise_confluence_tables",
    description="Normalise the tables of pages imported from Confluence and rebuild their documents",
    step=step,
)
