# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Count rows with no created_by and how many of them have an inferable creator. Read-only."""

from django.apps import apps
from django.core.management.base import BaseCommand
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
    if model.__name__ == "Issue":
        first_activity = IssueActivity._base_manager.filter(
            issue_id=OuterRef("pk"), verb="created", field__isnull=True, actor__isnull=False
        ).order_by("created_at")
        return Subquery(first_activity.values("actor_id")[:1])
    field = OWNER_FIELDS.get(model.__name__)
    return F(field) if field else None


def missing_creators():
    rows = []
    for model in apps.get_models():
        if not issubclass(model, BaseModel) or model._meta.proxy:
            continue
        missing = model._base_manager.filter(created_by__isnull=True)
        count = missing.count()
        if not count:
            continue
        source = inferred_creator(model)
        inferable = (
            missing.annotate(inferred=source).filter(inferred__isnull=False).count() if source is not None else None
        )
        rows.append((model.__name__, count, inferable))
    return sorted(rows)


class Command(BaseCommand):
    help = "Count rows with a null created_by per model and how many have an inferable creator. Changes nothing."

    def handle(self, *args, **options):
        rows = missing_creators()
        if not rows:
            self.stdout.write("No rows with a null created_by.")
            return
        self.stdout.write(f"{'model':<32} {'null created_by':>16} {'inferable':>10}")
        for name, count, inferable in rows:
            self.stdout.write(f"{name:<32} {count:>16} {'-' if inferable is None else inferable:>10}")
