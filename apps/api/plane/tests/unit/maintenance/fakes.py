# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.maintenance.upgrade import Batch, DataUpgrade, JsonValue


class FakeUpgrade:
    """Counts from 0 to `batches`, one batch per step, recording each cursor it is given."""

    def __init__(self, name: str, batches: int, calls: list[tuple[str, int]], fail_at: int | None = None) -> None:
        self.name = name
        self.batches = batches
        self.calls = calls
        self.fail_at = fail_at

    def step(self, cursor: JsonValue) -> Batch:
        position = cursor if isinstance(cursor, int) else 0
        self.calls.append((self.name, position))
        if position == self.fail_at:
            raise RuntimeError(f"{self.name} broke at {position}")
        following = position + 1
        return Batch(cursor=following if following < self.batches else None, counts={"changed": 1})

    @property
    def upgrade(self) -> DataUpgrade:
        return DataUpgrade(name=self.name, description=f"Fake {self.name}", step=self.step)
