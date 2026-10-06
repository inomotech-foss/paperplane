# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace

import pytest

from plane.importers.users import UserMatcher, UserRules


def account(email="", display_name="", account_id="acc-1"):
    return SimpleNamespace(account_id=account_id, email=email, display_name=display_name)


def user(email, display_name="", first_name="", last_name=""):
    return SimpleNamespace(email=email, display_name=display_name, first_name=first_name, last_name=last_name)


ALICE = user("alice@new.example", display_name="Alice A")
STUB = user("alice@old.example", display_name="Alice A")


@pytest.mark.unit
class TestUserRules:
    def test_parses_domains_and_map(self, tmp_path):
        path = tmp_path / "users.csv"
        path.write_text("# source,target\nacc-1, Bob@New.Example\nold@old.example,carol@new.example\n")

        rules = UserRules.from_options({"email_domain": ["Old.Example=new.example"], "user_map": str(path)})

        assert rules.domains == {"old.example": "new.example"}
        assert rules.overrides == {"acc-1": "bob@new.example", "old@old.example": "carol@new.example"}

    @pytest.mark.parametrize("rule", ["old.example", "=new.example", "old.example="])
    def test_rejects_a_malformed_domain_rule(self, rule):
        with pytest.raises(ValueError):
            UserRules.from_options({"email_domain": [rule]})

    def test_rejects_a_one_column_map_row(self, tmp_path):
        path = tmp_path / "users.csv"
        path.write_text("acc-1\n")

        with pytest.raises(ValueError):
            UserRules.from_options({"user_map": str(path)})


@pytest.mark.unit
class TestUserMatcher:
    def test_matches_on_email(self):
        assert UserMatcher([ALICE]).match(account("ALICE@new.example")) is ALICE

    def test_rewritten_domain_wins_over_the_original_address(self):
        rules = UserRules(domains={"old.example": "new.example"})

        assert UserMatcher([STUB, ALICE], rules).match(account("alice@old.example")) is ALICE

    def test_falls_back_to_the_original_address(self):
        rules = UserRules(domains={"old.example": "new.example"})

        assert UserMatcher([STUB], rules).match(account("alice@old.example")) is STUB

    def test_falls_back_to_display_name(self):
        assert UserMatcher([ALICE]).match(account("alice@other.example", "alice a")) is ALICE

    def test_override_by_account_id(self):
        rules = UserRules(overrides={"acc-1": "alice@new.example"})

        assert UserMatcher([ALICE], rules).match(account("someone@else.example")) is ALICE

    def test_override_that_misses_does_not_guess(self):
        rules = UserRules(overrides={"acc-1": "nobody@new.example"})

        assert UserMatcher([ALICE], rules).match(account("alice@new.example", "Alice A")) is None
