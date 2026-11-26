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

import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

from django.db.models import Model, QuerySet

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
