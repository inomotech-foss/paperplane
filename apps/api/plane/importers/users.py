# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import csv
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class UserRules:
    """How a backup's accounts translate to Plane addresses.

    ``domains`` rewrites an address's domain, old -> new. ``overrides`` maps an
    account id or an address straight to a Plane address and wins over both.
    """

    domains: dict = field(default_factory=dict)
    overrides: dict = field(default_factory=dict)

    @classmethod
    def from_options(cls, options):
        domains = {}
        for rule in options.get("email_domain") or ():
            old, sep, new = rule.partition("=")
            if not sep or not old.strip() or not new.strip():
                raise ValueError(f"--email-domain expects OLD=NEW, got {rule!r}")
            domains[old.strip().casefold()] = new.strip().casefold()

        overrides = {}
        if options.get("user_map"):
            with Path(options["user_map"]).open(newline="", encoding="utf-8") as file:
                for row in csv.reader(file):
                    if not row or not row[0].strip() or row[0].lstrip().startswith("#"):
                        continue
                    if len(row) != 2 or not row[1].strip():
                        raise ValueError(f"--user-map rows need two columns, got {row!r}")
                    overrides[row[0].strip().casefold()] = row[1].strip().casefold()
        return cls(domains=domains, overrides=overrides)

    def overridden(self, account):
        keys = (account.account_id.casefold(), (account.email or "").strip().casefold())
        return any(key and key in self.overrides for key in keys)

    def emails(self, account):
        """The addresses to look the account up by, in order.

        An override is the only candidate: an explicit mapping that misses
        should be reported, not quietly replaced by a guess.
        """
        email = (account.email or "").strip().casefold()
        for key in (account.account_id.casefold(), email):
            if key and key in self.overrides:
                return [self.overrides[key]]
        if not email:
            return []
        local, _, domain = email.rpartition("@")
        rewritten = f"{local}@{self.domains[domain]}" if domain in self.domains else None
        return [address for address in (rewritten, email) if address]


class UserMatcher:
    """Matches backup accounts to Plane users: by address, then by display name."""

    def __init__(self, users, rules=None):
        self.rules = rules or UserRules()
        self.by_email, self.by_name = {}, {}
        for user in users:
            if user.email:
                self.by_email.setdefault(user.email.casefold(), user)
            for name in filter(None, (user.display_name, f"{user.first_name} {user.last_name}".strip())):
                self.by_name.setdefault(name.casefold(), user)

    def match(self, account):
        for email in self.rules.emails(account):
            if email in self.by_email:
                return self.by_email[email]
        if account.display_name and not self.rules.overridden(account):
            return self.by_name.get(account.display_name.casefold())
        return None


def add_user_arguments(parser):
    parser.add_argument(
        "--email-domain",
        action="append",
        metavar="OLD=NEW",
        help="Match backup addresses on OLD as the same address on NEW; repeatable",
    )
    parser.add_argument(
        "--user-map", help="CSV of backup account id or email, Plane email; wins over every other match"
    )
