# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings

# Django imports
from django.db import models

# Module imports
from .base import BaseModel


class PageIndexEntry(BaseModel):
    """A queryable fact extracted from a page's content.

    Query blocks aggregate key/value rows, tasks and decisions across many
    pages. Those live inside each page's HTML, which no query can filter on, so
    the importer writes them out here as rows once and the blocks read these.

    One table for all three because the query is the same shape every time -
    filter a set of pages, filter a kind - and the whole index is a few tens of
    thousands of rows even on a large wiki.
    """

    PROPERTY = "property"
    TASK = "task"
    DECISION = "decision"

    KIND_CHOICES = ((PROPERTY, "Property"), (TASK, "Task"), (DECISION, "Decision"))

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="page_index_entries")
    page = models.ForeignKey("db.Page", on_delete=models.CASCADE, related_name="index_entries")
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=PROPERTY)
    # The property name. Tasks and decisions have no key.
    key = models.CharField(max_length=255, blank=True)
    value = models.TextField(blank=True)
    # Tasks that are ticked, and decisions, which are recorded only once taken.
    is_complete = models.BooleanField(default=False)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="page_index_entries"
    )
    due_date = models.DateField(null=True, blank=True)
    # Position within the page, so a listing keeps the order the reader sees.
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Page Index Entry"
        verbose_name_plural = "Page Index Entries"
        db_table = "page_index_entries"
        ordering = ("page_id", "sort_order")
        indexes = [
            # Every query filters a page set by kind, then either groups by key
            # or reads the values back in page order.
            models.Index(fields=["workspace", "kind", "key"], name="page_index_workspace_kind_key"),
            models.Index(fields=["page", "kind"], name="page_index_page_kind"),
        ]

    def __str__(self):
        return f"{self.kind} {self.key}"
