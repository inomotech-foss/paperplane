# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.apps import apps
from django.db.models import F, OuterRef, Subquery

from plane.db.models import BaseModel, IssueActivity

# Field that holds the user who created the row, for models that have one.
OWNER_FIELDS = {
    "Automation": "owned_by_id",
    "Cycle": "owned_by_id",
    "Dashboard": "owned_by_id",
    "IssueActivity": "actor_id",
    "IssueComment": "actor_id",
    "IssueDescriptionVersion": "owned_by_id",
    "IssueReaction": "actor_id",
    "IssueVersion": "owned_by_id",
    "IssueView": "owned_by_id",
    "Page": "owned_by_id",
    "PageComment": "actor_id",
    "PageVersion": "owned_by_id",
    "Sticky": "owner_id",
    "Workspace": "owner_id",
}


def inferred_creator(model):
    """Expression for the most likely creator of a row, or None when the model has no such source."""
    if model.__name__ == "Issue":
        first_activity = IssueActivity._base_manager.filter(
            issue_id=OuterRef("pk"), verb="created", field__isnull=True, actor__isnull=False
        ).order_by("created_at")
        return Subquery(first_activity.values("actor_id")[:1])
    field = OWNER_FIELDS.get(model.__name__)
    return F(field) if field else None


def creator_models():
    """Concrete models that record a creator, soft-deleted rows included through the base manager."""
    for model in apps.get_models():
        if issubclass(model, BaseModel) and not model._meta.proxy:
            yield model
