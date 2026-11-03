# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Count rows with no created_by and how many of them have an inferable creator. Read-only."""

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from plane.utils.missing_creators import creator_models, inferred_creator


def missing_creators():
    rows = []
    for model in creator_models():
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
    help = (
        "Count rows with a null created_by per model and how many have an inferable creator. "
        "Soft-deleted, archived and draft rows are included. "
        "Owner fields such as owned_by are a best guess for the creator. Runs in a read-only transaction."
    )

    def handle(self, *args, **options):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION READ ONLY")
            rows = missing_creators()
        if not rows:
            self.stdout.write("No rows with a null created_by.")
            return
        self.stdout.write(f"{'model':<32} {'null created_by':>16} {'inferable':>10}")
        for name, count, inferable in rows:
            self.stdout.write(f"{name:<32} {count:>16} {'-' if inferable is None else inferable:>10}")
