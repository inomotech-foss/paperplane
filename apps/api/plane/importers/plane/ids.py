# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from dataclasses import dataclass, field
from types import SimpleNamespace

from plane.db.models import User

from ..users import UserMatcher


def _uuid(value):
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


class IdMap:
    """Source id -> target id, per model.

    A row keeps its Plane id unless it was matched to a row the target already
    had; today only users are matched. A row the import chose to leave out is
    remembered as excluded, so what points at it is reported as outside the
    selection rather than as an orphan.
    """

    def __init__(self):
        self._ids = {}
        self._excluded = {}
        self._loaded = set()

    def add(self, model, source_id, target_id=None):
        source_id = _uuid(source_id)
        self._ids.setdefault(model, {})[source_id] = _uuid(target_id) if target_id else source_id

    def get(self, model, source_id):
        if source_id is None:
            return None
        return self._ids.get(model, {}).get(_uuid(source_id))

    def targets(self, model):
        """The target ids written or matched for `model`."""
        return set(self._ids.get(model, {}).values())

    def exclude(self, model, source_id):
        self._excluded.setdefault(model, set()).add(_uuid(source_id))

    def is_excluded(self, model, source_id):
        return source_id is not None and _uuid(source_id) in self._excluded.get(model, ())

    def mark_loaded(self, model):
        self._loaded.add(model)

    def loaded(self, model):
        return model in self._loaded

    def remapped(self):
        """Every id that changed on the way in, as strings, across models."""
        return {
            str(source): str(target) for ids in self._ids.values() for source, target in ids.items() if source != target
        }


def _account(row):
    """A Plane user in the shape ``importers.users`` matches on."""
    return SimpleNamespace(account_id=str(row["id"]), email=row.get("email"), display_name=row.get("display_name"))


@dataclass
class UserPlan:
    create: list = field(default_factory=list)
    matched: dict = field(default_factory=dict)
    renamed: list = field(default_factory=list)


def plan_users(rows, wanted_ids, rules=None):
    """Which source users to create and which the target already has.

    Matching is the Atlassian importers' (``importers.users``): by address,
    rewritten by ``--email-domain`` and overridden by ``--user-map``, but not
    by display name. That lets the import run on an instance where the admin
    signed up first. Each target account is claimed once, by a user-map entry
    first and an exact address next, so two source accounts never become one.
    Anyone else is created with their Plane id; a username the target or an
    earlier row already uses gets a numeric suffix rather than stopping the run.
    """
    wanted = {_uuid(user_id) for user_id in wanted_ids}
    rows = [row for row in rows if _uuid(row["id"]) in wanted]
    users = list(User.objects.all())
    exact = {user.email for user in users if user.email}
    # Matched by address and the user map only: the import creates logins, so
    # a shared display name must not make two people one account.
    matcher = UserMatcher(users, rules, names=False)
    taken = {user.username for user in users}
    plan = UserPlan()

    claimed = set()
    def order(row):
        # An explicit --user-map entry claims its account first, then exact addresses.
        return (not matcher.rules.overridden(_account(row)), row.get("email") not in exact)

    for row in sorted(rows, key=order):
        target = matcher.match(_account(row))
        if target is not None and target.id not in claimed:
            plan.matched[row["id"]] = target.id
            claimed.add(target.id)

    for row in rows:
        if row["id"] in plan.matched:
            continue
        username = row.get("username") or uuid.uuid4().hex
        unique, suffix = username, 2
        while unique in taken:
            unique, suffix = f"{username}-{suffix}", suffix + 1
        if unique != username:
            plan.renamed.append((username, unique))
        taken.add(unique)
        plan.create.append({**row, "username": unique})

    return plan
