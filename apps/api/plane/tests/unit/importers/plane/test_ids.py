# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest

from plane.db.models import Project, User
from plane.importers.plane.ids import IdMap, plan_users


def user_row(email, username=None):
    return {"id": uuid.uuid4(), "email": email, "username": username or uuid.uuid4().hex}


def test_idmap_defaults_to_same_id():
    ids, source = IdMap(), uuid.uuid4()
    ids.add(Project, source)
    assert ids.get(Project, source) == source
    assert ids.get(Project, str(source)) == source
    assert ids.get(Project, uuid.uuid4()) is None
    assert ids.get(Project, None) is None


def test_targets_lists_target_ids():
    ids, same, moved, target = IdMap(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    ids.add(User, same)
    ids.add(User, moved, target)
    assert ids.targets(User) == {same, target}
    assert ids.targets(Project) == set()


def test_remapped_lists_only_changed():
    ids, same, moved, target = IdMap(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    ids.add(User, same)
    ids.add(User, moved, target)
    assert ids.remapped() == {str(moved): str(target)}


def test_excluded_and_loaded():
    ids, source = IdMap(), uuid.uuid4()
    ids.exclude(Project, source)
    assert ids.is_excluded(Project, source)
    assert ids.get(Project, source) is None
    assert not ids.loaded(Project)
    ids.mark_loaded(Project)
    assert ids.loaded(Project)


@pytest.mark.django_db
def test_unmatched_user_keeps_its_id():
    row = user_row("new@example.test")
    plan = plan_users([row], {row["id"]})
    assert [r["id"] for r in plan.create] == [row["id"]]
    assert plan.matched == {}


@pytest.mark.django_db
def test_email_match_ignores_case():
    target = User.objects.create(email="ada@example.test", username="ada-target")
    row = user_row("ADA@example.test")
    plan = plan_users([row], {row["id"]})
    assert plan.create == []
    assert plan.matched == {row["id"]: target.id}


@pytest.mark.django_db
def test_case_twins_claim_the_target_once():
    target = User.objects.create(email="ada@example.test", username="ada-target")
    upper, lower = user_row("ADA@example.test"), user_row("ada@example.test")
    plan = plan_users([upper, lower], {upper["id"], lower["id"]})
    assert plan.matched == {lower["id"]: target.id}
    assert [r["id"] for r in plan.create] == [upper["id"]]


@pytest.mark.django_db
def test_taken_username_gets_suffix():
    User.objects.create(email="someone@example.test", username="ada")
    row = user_row("ada@elsewhere.test", username="ada")
    plan = plan_users([row], {row["id"]})
    assert plan.create[0]["username"] == "ada-2"
    assert plan.renamed == [("ada", "ada-2")]


@pytest.mark.django_db
def test_usernames_in_one_plan_do_not_clash():
    first, second = user_row("a@example.test", "same"), user_row("b@example.test", "same")
    plan = plan_users([first, second], {first["id"], second["id"]})
    assert [r["username"] for r in plan.create] == ["same", "same-2"]


@pytest.mark.django_db
def test_users_outside_wanted_are_ignored():
    wanted, other = user_row("w@example.test"), user_row("o@example.test")
    plan = plan_users([wanted, other], {wanted["id"]})
    assert [r["id"] for r in plan.create] == [wanted["id"]]
