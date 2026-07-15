# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for OIDC name-claim mapping (derive_names)."""

import pytest

from plane.authentication.provider.oauth.oidc import derive_names


@pytest.mark.unit
class TestDeriveNames:
    def test_all_claims_present(self):
        assert derive_names("First", "Last", "First Last") == ("First", "Last", "First Last")

    def test_missing_given_name_is_derived_from_full_name(self):
        # Entra often sends `name` + `family_name` but omits `given_name`; the
        # first name must not swallow the whole name (would be "First Last Last").
        assert derive_names(None, "Last", "First Last") == ("First", "Last", "First Last")

    def test_missing_given_name_multiword_family(self):
        assert derive_names("", "van der Berg", "Jan van der Berg") == (
            "Jan",
            "van der Berg",
            "Jan van der Berg",
        )

    def test_only_full_name_splits_first_token(self):
        assert derive_names(None, None, "First Middle Last") == ("First", "", "First Middle Last")

    def test_display_name_prefers_full_name(self):
        _, _, display = derive_names("First", "Last", "Display Name")
        assert display == "Display Name"

    def test_display_name_falls_back_to_assembled_parts(self):
        assert derive_names("First", "Last", None) == ("First", "Last", "First Last")

    def test_empty_claims(self):
        assert derive_names(None, None, None) == ("", "", "")

    def test_whitespace_is_stripped(self):
        assert derive_names("  First  ", "  Last  ", "  First Last  ") == ("First", "Last", "First Last")
