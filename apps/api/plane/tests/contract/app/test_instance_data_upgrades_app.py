# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the instance admin data upgrade endpoints."""

from unittest.mock import patch

import pytest

from plane.db.models import DataUpgradeState, User
from plane.tests.openapi import assert_matches_schema
from plane.tests.unit.maintenance.fakes import FakeUpgrade

URL = "/api/instances/data-upgrades/"
Status = DataUpgradeState.Status


@pytest.fixture(autouse=True)
def registered(monkeypatch):
    calls: list[tuple[str, int]] = []
    upgrades = (FakeUpgrade("2026_01_first", 2, calls).upgrade, FakeUpgrade("2026_01_second", 2, calls).upgrade)
    monkeypatch.setattr("plane.maintenance.upgrades.UPGRADES", upgrades)


@pytest.fixture
def member(db):
    return User.objects.create(email="member@plane.so", username="member")


@pytest.fixture
def enqueue():
    with patch("plane.license.api.views.data_upgrade.run_data_upgrades") as task:
        yield task.delay


@pytest.mark.contract
class TestInstanceDataUpgradeList:
    @pytest.mark.django_db
    def test_lists_registered_upgrades_in_order_with_their_state(self, instance_admin_client):
        DataUpgradeState.objects.create(name="2026_01_first", status=Status.DONE, counts={"changed": 5}, attempts=1)
        DataUpgradeState.objects.create(name="2025_12_removed", status=Status.DONE)

        response = instance_admin_client.get(URL)

        assert response.status_code == 200
        assert_matches_schema(response, surface="admin")
        first, second = response.json()
        assert (first["name"], first["status"], first["counts"], first["attempts"]) == (
            "2026_01_first",
            "done",
            {"changed": 5},
            1,
        )
        assert first["description"] == "Fake 2026_01_first"
        assert second == {
            "name": "2026_01_second",
            "description": "Fake 2026_01_second",
            "status": "pending",
            "counts": {},
            "error": "",
            "attempts": 0,
            "started_at": None,
            "finished_at": None,
            "updated_at": None,
        }

    @pytest.mark.django_db
    def test_non_admins_are_refused(self, api_client, member):
        assert api_client.get(URL).status_code in (401, 403)
        api_client.force_authenticate(user=member)
        assert api_client.get(URL).status_code == 403


@pytest.mark.contract
class TestInstanceDataUpgradeRetry:
    @pytest.mark.django_db
    def test_sets_a_failed_upgrade_back_to_pending_and_enqueues_the_runner(self, instance_admin_client, enqueue):
        DataUpgradeState.objects.create(
            name="2026_01_first", status=Status.FAILED, cursor=1, counts={"changed": 1}, error="boom", attempts=1
        )

        response = instance_admin_client.post(f"{URL}2026_01_first/retry/")

        assert response.status_code == 200
        assert_matches_schema(response, surface="admin")
        assert response.json()["status"] == "pending"
        assert response.json()["error"] == ""
        retried = DataUpgradeState.objects.get(name="2026_01_first")
        assert (retried.status, retried.cursor, retried.counts) == (Status.PENDING, 1, {"changed": 1})
        enqueue.assert_called_once_with()

    @pytest.mark.django_db
    @pytest.mark.parametrize("status", [Status.PENDING, Status.RUNNING, Status.DONE])
    def test_only_a_failed_upgrade_can_be_retried(self, instance_admin_client, enqueue, status):
        DataUpgradeState.objects.create(name="2026_01_first", status=status)

        response = instance_admin_client.post(f"{URL}2026_01_first/retry/")

        assert response.status_code == 409
        assert DataUpgradeState.objects.get(name="2026_01_first").status == status
        enqueue.assert_not_called()

    @pytest.mark.django_db
    def test_a_pending_upgrade_without_a_row_cannot_be_retried(self, instance_admin_client, enqueue):
        assert instance_admin_client.post(f"{URL}2026_01_second/retry/").status_code == 409

    @pytest.mark.django_db
    def test_unknown_upgrade_is_404(self, instance_admin_client, enqueue):
        DataUpgradeState.objects.create(name="2025_12_removed", status=Status.FAILED)

        response = instance_admin_client.post(f"{URL}2025_12_removed/retry/")

        assert response.status_code == 404
        assert DataUpgradeState.objects.get(name="2025_12_removed").status == Status.FAILED
        enqueue.assert_not_called()

    @pytest.mark.django_db
    def test_non_admins_are_refused(self, api_client, member, enqueue):
        DataUpgradeState.objects.create(name="2026_01_first", status=Status.FAILED)
        api_client.force_authenticate(user=member)

        response = api_client.post(f"{URL}2026_01_first/retry/")

        assert response.status_code == 403
        assert DataUpgradeState.objects.get(name="2026_01_first").status == Status.FAILED
        enqueue.assert_not_called()
