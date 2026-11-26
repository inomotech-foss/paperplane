# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import connection

from plane.bgtasks import data_upgrade_task
from plane.bgtasks.data_upgrade_task import run_data_upgrades
from plane.db.models import DataUpgradeState
from plane.maintenance import runner
from plane.maintenance.runner import Outcome, run_pending
from plane.maintenance.upgrade import Batch, DataUpgrade, JsonValue, keyset_batch
from plane.maintenance.upgrades import UPGRADES

from .fakes import FakeUpgrade

pytestmark = [pytest.mark.unit, pytest.mark.django_db]

Status = DataUpgradeState.Status
BUDGET = timedelta(minutes=1)


@pytest.fixture
def calls() -> list[tuple[str, int]]:
    return []


def register(monkeypatch: pytest.MonkeyPatch, *fakes: FakeUpgrade) -> None:
    monkeypatch.setattr("plane.maintenance.upgrades.UPGRADES", tuple(fake.upgrade for fake in fakes))


def state(name: str) -> DataUpgradeState:
    return DataUpgradeState.objects.get(name=name)


def test_runs_upgrades_in_order_and_sums_counts(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 2, calls), FakeUpgrade("2026_01_second", 3, calls))

    assert run_pending(BUDGET) is Outcome.DONE

    assert calls == [
        ("2026_01_first", 0),
        ("2026_01_first", 1),
        ("2026_01_second", 0),
        ("2026_01_second", 1),
        ("2026_01_second", 2),
    ]
    first, second = state("2026_01_first"), state("2026_01_second")
    assert (first.status, first.counts, first.cursor, first.attempts) == (Status.DONE, {"changed": 2}, None, 1)
    assert second.counts == {"changed": 3}
    assert first.started_at is not None and first.finished_at is not None


def test_resumes_from_the_saved_cursor(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 4, calls))
    DataUpgradeState.objects.create(
        name="2026_01_first", status=Status.RUNNING, cursor=2, counts={"changed": 2}, attempts=1
    )

    assert run_pending(BUDGET) is Outcome.DONE

    assert calls == [("2026_01_first", 2), ("2026_01_first", 3)]
    resumed = state("2026_01_first")
    assert (resumed.status, resumed.counts, resumed.attempts) == (Status.DONE, {"changed": 4}, 1)


def test_a_failure_stops_the_run_and_later_upgrades_wait(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 3, calls, fail_at=1), FakeUpgrade("2026_01_second", 1, calls))

    assert run_pending(BUDGET) is Outcome.FAILED

    failed = state("2026_01_first")
    assert failed.status == Status.FAILED
    assert failed.cursor == 1
    assert failed.counts == {"changed": 1}
    assert "2026_01_first broke at 1" in failed.error
    assert not DataUpgradeState.objects.filter(name="2026_01_second").exists()

    calls.clear()
    assert run_pending(BUDGET) is Outcome.FAILED
    assert calls == []


def test_retry_resumes_the_failed_batch(monkeypatch, calls):
    first = FakeUpgrade("2026_01_first", 3, calls, fail_at=1)
    register(monkeypatch, first, FakeUpgrade("2026_01_second", 1, calls))
    run_pending(BUDGET)
    first.fail_at = None
    calls.clear()

    assert runner.retry("2026_01_first") is True
    assert state("2026_01_first").status == Status.PENDING
    assert run_pending(BUDGET) is Outcome.DONE

    assert calls == [("2026_01_first", 1), ("2026_01_first", 2), ("2026_01_second", 0)]
    retried = state("2026_01_first")
    assert (retried.status, retried.counts, retried.attempts, retried.error) == (Status.DONE, {"changed": 3}, 2, "")


def test_only_a_failed_upgrade_can_be_retried(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 1, calls))
    run_pending(BUDGET)

    assert runner.retry("2026_01_first") is False
    assert runner.retry("2026_01_unknown") is False
    assert state("2026_01_first").status == Status.DONE


def test_a_finished_upgrade_does_not_run_again(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 2, calls))
    run_pending(BUDGET)
    calls.clear()

    assert run_pending(BUDGET) is Outcome.DONE

    assert calls == []
    assert state("2026_01_first").counts == {"changed": 2}


def test_an_upgrade_with_nothing_to_do_finishes_with_zero_counts(monkeypatch):
    def step(cursor: JsonValue) -> Batch:
        return Batch(cursor=None)

    monkeypatch.setattr(
        "plane.maintenance.upgrades.UPGRADES",
        (DataUpgrade(name="2026_01_noop", description="Nothing", step=step),),
    )

    assert run_pending(BUDGET) is Outcome.DONE

    assert (state("2026_01_noop").status, state("2026_01_noop").counts) == (Status.DONE, {})


def test_the_task_re_enqueues_itself_when_time_runs_out(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 3, calls))
    monkeypatch.setattr(data_upgrade_task, "TIME_BUDGET", timedelta(0))

    with patch.object(run_data_upgrades, "delay") as delay:
        assert run_data_upgrades() == Outcome.MORE

    delay.assert_called_once_with()
    assert calls == [("2026_01_first", 0)]
    paused = state("2026_01_first")
    assert (paused.status, paused.cursor) == (Status.RUNNING, 1)


def test_the_task_does_not_re_enqueue_when_everything_is_done(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 2, calls))

    with patch.object(run_data_upgrades, "delay") as delay:
        assert run_data_upgrades() == Outcome.DONE

    delay.assert_not_called()


def test_exits_quietly_without_the_state_table(monkeypatch, calls):
    register(monkeypatch, FakeUpgrade("2026_01_first", 1, calls))
    monkeypatch.setattr(connection.introspection, "table_names", lambda *args, **kwargs: [])

    assert run_pending(BUDGET) is Outcome.NO_TABLE

    assert calls == []
    assert not DataUpgradeState.objects.exists()


def test_registered_names_are_unique():
    names = [upgrade.name for upgrade in UPGRADES]
    assert len(names) == len(set(names))


@pytest.mark.parametrize("name", ["normalise_tables", "2026_11_Upper", "2026-11-dashes", "2026_11_" + "x" * 100])
def test_rejects_names_that_do_not_follow_the_pattern(name):
    with pytest.raises(ValueError):
        DataUpgrade(name=name, description="", step=FakeUpgrade("2026_01_x", 1, []).step)


def test_keyset_batch_walks_the_primary_key():
    for name in ("2026_01_a", "2026_01_b", "2026_01_c"):
        DataUpgradeState.objects.create(name=name)
    rows = DataUpgradeState.objects.all()

    first, cursor = keyset_batch(rows, None, 2)
    assert [row.name for row in first] == ["2026_01_a", "2026_01_b"]
    assert cursor == "2026_01_b"

    rest, cursor = keyset_batch(rows, cursor, 2)
    assert [row.name for row in rest] == ["2026_01_c"]
    assert cursor is None
