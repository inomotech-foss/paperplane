# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Model

from plane.maintenance.upgrade import Batch, DataUpgrade, JsonValue, keyset_batch
from plane.utils.missing_creators import creator_models, inferred_creator

BATCH_SIZE = 2000


def _models() -> dict[str, type[Model]]:
    found = {model._meta.label: model for model in creator_models() if inferred_creator(model) is not None}
    return dict(sorted(found.items()))


def _position(cursor: JsonValue, labels: list[str]) -> tuple[str, str | None]:
    if cursor is None:
        return labels[0], None
    if isinstance(cursor, dict):
        label, after = cursor.get("model"), cursor.get("after")
        if label in labels and (after is None or isinstance(after, str)):
            return label, after
    raise ValueError(f"Unexpected cursor {cursor!r}")


def step(cursor: JsonValue) -> Batch:
    models = _models()
    labels = list(models)
    label, after = _position(cursor, labels)
    model = models[label]
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
    counts = {"filled": filled}
    if after is not None:
        return Batch(cursor={"model": label, "after": after}, counts=counts)
    following = labels.index(label) + 1
    if following == len(labels):
        return Batch(cursor=None, counts=counts)
    return Batch(cursor={"model": labels[following], "after": None}, counts=counts)


UPGRADE = DataUpgrade(
    name="2026_11_backfill_creators",
    description="Fill a missing creator from the row's owner or actor, or for work items from the actor of their "
    "first created activity. A creator that is set is never changed.",
    step=step,
)
