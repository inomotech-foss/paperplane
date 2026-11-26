# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging
from datetime import date

from celery import shared_task

from plane.db.models import Page, User
from plane.utils import page_approval
from plane.utils.page_approval import ApprovalError

logger = logging.getLogger("plane.worker")


@shared_task
def baseline_pages(project_id, page_ids, actor_id, next_review_date=None, comment="", include_locked=False):
    """Baseline the given pages of a project. A page that is no longer eligible is logged and skipped."""
    actor = User.objects.get(pk=actor_id)
    review_date = date.fromisoformat(next_review_date) if next_review_date else None
    pages = Page.objects.filter(
        pk__in=page_ids, project_pages__project_id=project_id, project_pages__deleted_at__isnull=True
    ).distinct()
    baselined = skipped = 0
    for page in pages.order_by("name", "id").iterator(chunk_size=50):
        reason = page_approval.baseline_skip_reason(page, include_locked)
        if reason:
            logger.info("Page %s not baselined: %s", page.id, reason)
            skipped += 1
            continue
        try:
            page_approval.baseline(
                page,
                project_id,
                actor,
                legacy=page_approval.page_legacy(page),
                next_review_date=review_date,
                comment=comment,
            )
        except ApprovalError as error:
            # e.g. someone submitted the page meanwhile
            logger.warning("Page %s not baselined: %s", page.id, error.message)
            skipped += 1
            continue
        baselined += 1
    logger.info("Project %s: baselined %s pages, skipped %s", project_id, baselined, skipped)
    return {"baselined": baselined, "skipped": skipped}
