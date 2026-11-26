# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Runs the registered data upgrades in order, one committed batch at a time."""

import logging
import time
import traceback
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from datetime import timedelta
from enum import StrEnum

from django.db import connection, transaction
from django.utils import timezone

from plane.db.models import DataUpgradeState
from plane.maintenance import upgrades
from plane.maintenance.upgrade import DataUpgrade

logger = logging.getLogger("plane.maintenance")

# Any fixed number works, as long as every worker uses the same one.
LOCK_KEY = 0x504C414E45_55
ERROR_MAX_LENGTH = 20_000
MAX_RESUMES = 3
STUCK_ERROR = (
    f"The worker stopped at least {MAX_RESUMES} times in the same batch, "
    "for example out of memory or at its time limit. Retry once the cause is fixed."
)

Status = DataUpgradeState.Status


class Outcome(StrEnum):
    DONE = "done"
    MORE = "more"
    FAILED = "failed"
    BUSY = "busy"
    NO_TABLE = "no_table"


def run_pending(budget: timedelta, clock: Callable[[], float] = time.monotonic) -> Outcome:
    """Runs pending upgrades until all are done, one fails or the time budget is spent.

    At least one batch runs per call, whatever the budget.
    """
    if DataUpgradeState._meta.db_table not in connection.introspection.table_names():
        return Outcome.NO_TABLE
    with _advisory_lock() as acquired:
        if not acquired:
            return Outcome.BUSY
        return _run(upgrades.UPGRADES, clock() + budget.total_seconds(), clock)


def retry(name: str) -> bool:
    """Sets a failed upgrade back to pending, keeping its cursor. Returns False if it had not failed."""
    return bool(
        DataUpgradeState.objects.filter(name=name, status=Status.FAILED).update(
            status=Status.PENDING, error="", updated_at=timezone.now()
        )
    )


@contextmanager
def _advisory_lock() -> Iterator[bool]:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [LOCK_KEY])
        row = cursor.fetchone()
    acquired = bool(row and row[0])
    try:
        yield acquired
    finally:
        if acquired:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [LOCK_KEY])


def _run(registry: tuple[DataUpgrade, ...], deadline: float, clock: Callable[[], float]) -> Outcome:
    states = {state.name: state for state in DataUpgradeState.objects.filter(name__in=[u.name for u in registry])}
    worked = False
    for upgrade in registry:
        state = states.get(upgrade.name) or DataUpgradeState(name=upgrade.name)
        if state.status == Status.DONE:
            continue
        if state.status == Status.FAILED:
            return Outcome.FAILED
        if worked and clock() >= deadline:
            return Outcome.MORE
        outcome = _run_upgrade(upgrade, state, deadline, clock)
        if outcome is not Outcome.DONE:
            return outcome
        worked = True
    return Outcome.DONE


def _run_upgrade(upgrade: DataUpgrade, state: DataUpgradeState, deadline: float, clock: Callable[[], float]) -> Outcome:
    if state.status == Status.PENDING:
        state.status = Status.RUNNING
        state.attempts += 1
        state.started_at = timezone.now()
        state.finished_at = None
        state.resumes = 0
        state.save()
        logger.info("Data upgrade %s started", upgrade.name)
    elif state.resumes >= MAX_RESUMES:
        logger.error("Data upgrade %s failed: %s", upgrade.name, STUCK_ERROR)
        _fail(upgrade, STUCK_ERROR)
        return Outcome.FAILED
    else:
        # Saved before the batch runs, so a batch that kills the worker is counted.
        state.resumes += 1
        state.save(update_fields=["resumes", "updated_at"])
        logger.info("Data upgrade %s resumed (%s)", upgrade.name, state.resumes)

    while True:
        try:
            with transaction.atomic():
                batch = upgrade.step(state.cursor)
                state.cursor = batch.cursor
                state.counts = _added(state.counts, batch.counts)
                state.resumes = 0
                if batch.cursor is None:
                    state.status = Status.DONE
                    state.finished_at = timezone.now()
                state.save()
        except Exception as error:
            logger.exception("Data upgrade %s failed", upgrade.name)
            _fail(upgrade, _error_text(error))
            return Outcome.FAILED
        if state.status == Status.DONE:
            logger.info("Data upgrade %s done: %s", upgrade.name, state.counts)
            return Outcome.DONE
        if clock() >= deadline:
            return Outcome.MORE


def _added(totals: dict[str, int], counts: Mapping[str, int]) -> dict[str, int]:
    return {**totals, **{key: totals.get(key, 0) + value for key, value in counts.items()}}


def _fail(upgrade: DataUpgrade, error: str) -> None:
    DataUpgradeState.objects.filter(name=upgrade.name).update(
        status=Status.FAILED, error=error, updated_at=timezone.now()
    )


def _error_text(error: Exception) -> str:
    return "".join(traceback.format_exception(error))[-ERROR_MAX_LENGTH:]
