# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace

import pytest
from crum import get_current_user, impersonate

from plane.db.models import Page, User
from plane.utils.task_actor import HEADER, act_as_actor, attach_actor, restore_actor

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


def _task(headers: dict[str, str], is_eager: bool = False) -> SimpleNamespace:
    return SimpleNamespace(request=SimpleNamespace(get=headers.get, is_eager=is_eager))


@pytest.fixture(autouse=True)
def connection_cleanups(monkeypatch) -> list[bool]:
    calls: list[bool] = []
    monkeypatch.setattr("django.db.close_old_connections", lambda: calls.append(True))
    return calls


@pytest.fixture
def other_user(db) -> User:
    return User.objects.create(email="actor@plane.so", username="actor")


def test_a_task_queued_in_a_request_carries_the_user(create_user):
    headers: dict[str, str] = {}
    with impersonate(create_user):
        attach_actor(headers=headers)

    assert headers == {HEADER: str(create_user.id)}


def test_a_task_queued_without_a_user_carries_none():
    headers: dict[str, str] = {}
    attach_actor(headers=headers)

    assert headers == {}


def test_the_worker_runs_the_task_as_the_user_and_forgets_them(create_user, connection_cleanups):
    act_as_actor(task=_task({HEADER: str(create_user.id)}))
    assert get_current_user() == create_user
    assert connection_cleanups == [True]

    restore_actor()
    assert get_current_user() is None


def test_an_eager_task_keeps_and_restores_the_request_user(create_user, other_user, connection_cleanups):
    with impersonate(create_user):
        act_as_actor(task=_task({}, is_eager=True))
        assert get_current_user() == create_user
        restore_actor()

        act_as_actor(task=_task({HEADER: str(other_user.id)}, is_eager=True))
        assert get_current_user() == other_user
        restore_actor()

        assert get_current_user() == create_user
    assert connection_cleanups == []


def test_a_queued_task_records_its_creator(create_user, workspace):
    act_as_actor(task=_task({HEADER: str(create_user.id)}))
    try:
        page = Page.objects.create(name="From a task", workspace=workspace, owned_by=create_user)
    finally:
        restore_actor()

    assert Page.objects.values_list("created_by_id", flat=True).get(pk=page.pk) == create_user.id
