# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Model

from plane.maintenance.upgrade import Batch, DataUpgrade, JsonValue, keyset_batch, step_through
from plane.utils.missing_creators import creator_models, inferred_creator

BATCH_SIZE = 2000


def _models() -> dict[str, type[Model]]:
    found = {model._meta.label: model for model in creator_models() if inferred_creator(model) is not None}
    return dict(sorted(found.items()))


def _fill(label: str, model: type[Model], after: str | None) -> tuple[str | None, dict[str, int]]:
    source = inferred_creator(model)
    missing = (
        model._base_manager.filter(created_by__isnull=True)
        .annotate(inferred=source)
        .filter(inferred__isnull=False)
        .only("pk")
    )
    rows, after = keyset_batch(missing, after, BATCH_SIZE)
    filled = 0
    if rows:
        filled = model._base_manager.filter(pk__in=[row.pk for row in rows], created_by__isnull=True).update(
            created_by_id=source
        )
    return after, {"filled": filled}


def step(cursor: JsonValue) -> Batch:
    return step_through(_models(), cursor, _fill)


UPGRADE = DataUpgrade(
    name="2026_11_backfill_creators",
    description="Fill a missing creator from the row's owner or actor, or for work items from the actor of their "
    "first created activity. A creator that is set is never changed.",
    step=step,
)
