# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the user training progress endpoints.

Trainings are defined in frontend code; the backend only persists per-user
progress rows keyed by training_key and never validates keys against a
registry — only their shape.
"""

from uuid import uuid4

import pytest
from rest_framework import status

from plane.db.models import User, UserTrainingProgress

pytestmark = pytest.mark.contract

TRAININGS_URL = "/api/users/me/trainings/"


@pytest.fixture
def other_user(db):
    uid = uuid4().hex[:8]
    return User.objects.create(
        email=f"other-{uid}@plane.so",
        username=f"other_{uid}",
        first_name="Other",
        last_name="User",
    )


class TestUserTrainingProgressList:
    def test_list_empty(self, session_client):
        response = session_client.get(TRAININGS_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_list_is_scoped_to_current_user(self, session_client, create_user, other_user):
        UserTrainingProgress.objects.create(user=other_user, training_key="work_items")
        UserTrainingProgress.objects.create(user=create_user, training_key="cycles")

        response = session_client.get(TRAININGS_URL)
        assert response.status_code == status.HTTP_200_OK
        assert [row["training_key"] for row in response.data] == ["cycles"]

    def test_requires_authentication(self, api_client):
        response = api_client.get(TRAININGS_URL)
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


class TestUserTrainingProgressUpsert:
    def test_upsert_creates_row_and_stamps_seen(self, session_client, create_user):
        response = session_client.post(f"{TRAININGS_URL}work_items/", {"seen": True}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["training_key"] == "work_items"
        assert response.data["seen_at"] is not None
        assert response.data["completed_at"] is None

        row = UserTrainingProgress.objects.get(user=create_user, training_key="work_items")
        assert row.seen_at is not None

    def test_upsert_is_idempotent_and_never_unsets_timestamps(self, session_client):
        first = session_client.post(f"{TRAININGS_URL}work_items/", {"seen": True}, format="json")
        second = session_client.post(f"{TRAININGS_URL}work_items/", {"seen": True}, format="json")
        assert second.status_code == status.HTTP_200_OK
        assert second.data["seen_at"] == first.data["seen_at"]

        # a payload without flags does not clear existing timestamps
        third = session_client.post(f"{TRAININGS_URL}work_items/", {}, format="json")
        assert third.data["seen_at"] == first.data["seen_at"]

    def test_completed_steps_merge(self, session_client):
        session_client.post(
            f"{TRAININGS_URL}cycles/", {"completed_steps": ["step_zero", "step_one"]}, format="json"
        )
        response = session_client.post(
            f"{TRAININGS_URL}cycles/", {"completed_steps": ["step_one", "step_two"]}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["completed_steps"] == ["step_one", "step_two", "step_zero"]

    def test_completed_stamps_completed_at(self, session_client):
        response = session_client.post(f"{TRAININGS_URL}cycles/", {"completed": True}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["completed_at"] is not None

    def test_invalid_training_key_rejected(self, session_client):
        response = session_client.post(f"{TRAININGS_URL}Bad-Key/", {"seen": True}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not UserTrainingProgress.objects.exists()

    def test_invalid_completed_steps_rejected(self, session_client):
        response = session_client.post(
            f"{TRAININGS_URL}cycles/", {"completed_steps": "step_zero"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestUserTrainingProgressBulkSeen:
    def test_bulk_mark_seen(self, session_client, create_user):
        response = session_client.post(
            TRAININGS_URL, {"training_keys": ["work_items", "cycles"], "seen": True}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert {row["training_key"] for row in response.data} == {"work_items", "cycles"}
        assert all(row["seen_at"] is not None for row in response.data)
        assert UserTrainingProgress.objects.filter(user=create_user, seen_at__isnull=False).count() == 2

    def test_bulk_rejects_empty_or_invalid_keys(self, session_client):
        response = session_client.post(TRAININGS_URL, {"training_keys": [], "seen": True}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response = session_client.post(
            TRAININGS_URL, {"training_keys": ["ok_key", "Bad Key"], "seen": True}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
