# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Project

# Ordinary names that were rejected because the identifier rule was applied to
# the name. Parentheses, hyphens, dots, commas and ampersands are all legitimate
# in a user-facing label.
VALID_NAMES = [
    "Integrated Management System (IMS)",
    "Wiki IMS (Q1) - v2",
    "R&D",
    "Q1/Q2 Planning",
    "v1.0 rollout",
    "Sales, Marketing & Ops",
    "Plane",
    "日本語",
    "Müller GmbH",
]

# Injection-risk characters, matching hasInjectionRiskChars in
# packages/utils/src/validation.ts.
INJECTION_NAMES = [
    "Plane<script>",
    'Plane"quoted"',
    "Plane'quoted'",
    "Plane{templated}",
    "Plane[indexed]",
    "Plane*star",
    "Plane^caret",
    "Plane!bang",
    "Plane#hash",
    "Plane%percent",
]

SYMBOL_ONLY_NAMES = ["-_________-", "---", "   ", "()", "..."]

# The identifier rule stays strict: alphanumeric only.
INVALID_IDENTIFIERS = ["W-IMS", "W.IMS", "W IMS?", "W(IMS)", "W@IMS"]
VALID_IDENTIFIERS = ["WIMS", "PROJ1", "W_IMS"]


@pytest.mark.unit
class TestProjectNameValidation:
    @pytest.mark.parametrize("name", VALID_NAMES)
    def test_accepts_ordinary_names(self, name):
        assert Project.is_valid_name(name)

    @pytest.mark.parametrize("name", INJECTION_NAMES)
    def test_rejects_injection_risk_characters(self, name):
        assert not Project.is_valid_name(name)

    @pytest.mark.parametrize("name", SYMBOL_ONLY_NAMES)
    def test_rejects_symbol_only_names(self, name):
        assert not Project.is_valid_name(name)

    def test_rejects_empty_name(self):
        assert not Project.is_valid_name("")
        assert not Project.is_valid_name(None)


@pytest.mark.unit
class TestProjectIdentifierValidation:
    @pytest.mark.parametrize("identifier", INVALID_IDENTIFIERS)
    def test_rejects_special_characters(self, identifier):
        assert Project.has_forbidden_identifier_chars(identifier)

    @pytest.mark.parametrize("identifier", VALID_IDENTIFIERS)
    def test_accepts_alphanumeric(self, identifier):
        assert not Project.has_forbidden_identifier_chars(identifier)
