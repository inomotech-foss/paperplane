# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Fill a null created_by from the row's owner, actor or first "created" activity. Dry run by default."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from plane.utils.missing_creators import creator_models, inferred_creator

BATCH_SIZE = 2000


def backfill(model, source, apply, batch_size=BATCH_SIZE):
    """Fills created_by in batches of primary keys and returns how many rows were (or would be) filled."""
    rows = (
        model._base_manager.filter(created_by__isnull=True)
        .annotate(inferred=source)
        .filter(inferred__isnull=False)
        .order_by("pk")
    )
    filled, last_pk = 0, None
    while True:
        batch = rows if last_pk is None else rows.filter(pk__gt=last_pk)
        ids = list(batch.values_list("pk", flat=True)[:batch_size])
        if not ids:
            return filled
        last_pk = ids[-1]
        if not apply:
            filled += len(ids)
            continue
        with transaction.atomic():
            filled += model._base_manager.filter(pk__in=ids, created_by__isnull=True).update(created_by_id=source)


class Command(BaseCommand):
    help = (
        "Fill a null created_by from the owner or actor field, or for work items from the actor of their first "
        "'created' activity. Rows without such a source stay null. Never overwrites a set created_by, and does not "
        "touch updated_at or send signals. Dry run unless --apply is given."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the changes. Without it, only count.")
        parser.add_argument("--model", action="append", default=[], help="Limit to these models (repeatable).")
        parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)

    def handle(self, *args, **options):
        if options["batch_size"] < 1:
            raise CommandError("--batch-size must be at least 1")
        models = {model.__name__: model for model in creator_models() if inferred_creator(model) is not None}
        unknown = sorted(set(options["model"]) - set(models))
        if unknown:
            raise CommandError(f"No creator source for: {', '.join(unknown)}")
        selected = options["model"] or sorted(models)
        verb = "filled" if options["apply"] else "would fill"
        total = 0
        for name in selected:
            model = models[name]
            count = backfill(model, inferred_creator(model), options["apply"], options["batch_size"])
            if count:
                self.stdout.write(f"{name}: {verb} {count}")
            total += count
        self.stdout.write(f"Total: {verb} {total}" + ("" if options["apply"] else " (dry run, pass --apply to write)"))
