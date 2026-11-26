# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The contract of a data upgrade.

A data upgrade changes stored data after a deploy, in the Celery worker. Its
step function gets the saved cursor (None at the start), processes one bounded
batch and returns the next cursor (None when finished) with counts to add to
the totals. The runner commits each batch together with its cursor, so side
effects that must only happen once the batch is stored go through
transaction.on_commit.

Running an upgrade again after it finished must change nothing.
"""

import logging
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

from django.db.models import Model, QuerySet

logger = logging.getLogger("plane.maintenance")

type JsonValue = str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]

NAME_PATTERN = re.compile(r"\d{4}_\d{2}_[a-z0-9_]+")
NAME_MAX_LENGTH = 100


@dataclass(frozen=True)
class Batch:
    cursor: JsonValue
    counts: Mapping[str, int] = field(default_factory=dict)


type Step = Callable[[JsonValue], Batch]


@dataclass(frozen=True)
class DataUpgrade:
    """A registered upgrade. The name is stored, so it is never renamed or reused."""

    name: str
    description: str
    step: Step

    def __post_init__(self) -> None:
        if len(self.name) > NAME_MAX_LENGTH or not NAME_PATTERN.fullmatch(self.name):
            raise ValueError(f"Data upgrade name must look like 2026_11_short_name, got {self.name!r}")


def keyset_batch[M: Model](queryset: QuerySet[M], after: str | None, size: int) -> tuple[list[M], str | None]:
    """The next rows after the primary key `after`, in primary key order, and the cursor that follows them.

    The cursor is None once the last row was returned.
    """
    rows = queryset.order_by("pk")
    if after is not None:
        rows = rows.filter(pk__gt=after)
    batch = list(rows[:size])
    if len(batch) < size:
        return batch, None
    return batch, str(batch[-1].pk)


type PartStep[T] = Callable[[str, T, str | None], tuple[str | None, Mapping[str, int]]]


def step_through[T](parts: Mapping[str, T], cursor: JsonValue, step: PartStep[T]) -> Batch:
    """One batch of an upgrade that walks several parts, such as models, in the order of `parts`.

    `step` gets the part's name, the part and its keyset cursor, and returns the next keyset cursor
    (None when the part is done) with its counts. The upgrade's cursor is {"name": ..., "after": ...}.
    A cursor that names no part starts over from the first one, which is safe as upgrades are idempotent.
    """
    names = list(parts)
    if not names:
        return Batch(cursor=None)
    name, after = _position(cursor, names)
    following, counts = step(name, parts[name], after)
    if following is not None:
        return Batch(cursor={"name": name, "after": following}, counts=counts)
    index = names.index(name) + 1
    if index == len(names):
        return Batch(cursor=None, counts=counts)
    return Batch(cursor={"name": names[index], "after": None}, counts=counts)


def _position(cursor: JsonValue, names: list[str]) -> tuple[str, str | None]:
    if cursor is None:
        return names[0], None
    if isinstance(cursor, dict):
        name, after = cursor.get("name"), cursor.get("after")
        if isinstance(name, str) and name in names and (after is None or isinstance(after, str)):
            return name, after
    logger.warning("Data upgrade cursor %r names no known part, starting over from %s", cursor, names[0])
    return names[0], None
