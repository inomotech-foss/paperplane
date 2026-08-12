# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Project
from plane.importers.confluence.naming import project_identifier, project_name


@pytest.mark.unit
class TestProjectName:
    @pytest.mark.parametrize(
        "space_name,expected",
        [
            ("Integrated Management System (IMS)", "Wiki Integrated Management System (IMS)"),
            ("Q1/Q2 Planning", "Wiki Q1/Q2 Planning"),
            ("R&D", "Wiki R&D"),
            ("Team <script>", "Wiki Team script"),
            ("100% Coverage", "Wiki 100 Coverage"),
        ],
    )
    def test_names_are_valid_and_readable(self, space_name, expected):
        name = project_name(space_name, "KEY")

        assert name == expected
        assert Project.is_valid_name(name)

    def test_symbol_only_name_falls_back_to_the_space_key(self):
        assert project_name("###", "IMS") == "Wiki IMS"

    def test_missing_name_falls_back_to_the_space_key(self):
        assert project_name("", "IMS") == "Wiki IMS"

    def test_a_free_name_is_left_alone(self):
        assert project_name("Legal", "LEGAL", taken={"Wiki Something"}) == "Wiki Legal"

    def test_a_taken_name_is_disambiguated_by_space_key(self):
        """Two spaces can share a display name, and the name is unique per workspace."""
        assert project_name("Legal", "LEGAL2", taken={"Wiki Legal"}) == "Wiki Legal (LEGAL2)"

    def test_a_taken_name_is_matched_regardless_of_case(self):
        assert project_name("Legal", "LEGAL2", taken={"wiki legal"}) == "Wiki Legal (LEGAL2)"

    def test_a_counter_is_used_when_the_key_is_taken_too(self):
        taken = {"Wiki Legal", "Wiki Legal (LEGAL)"}

        assert project_name("Legal", "LEGAL", taken=taken) == "Wiki Legal 2"

    def test_disambiguated_names_stay_valid(self):
        name = project_name("Legal", "LEGAL2", taken={"Wiki Legal"})

        assert Project.is_valid_name(name)

    def test_a_key_fallback_name_is_also_disambiguated(self):
        assert project_name("###", "IMS", taken={"Wiki IMS"}) == "Wiki IMS (IMS)"


@pytest.mark.unit
class TestProjectIdentifier:
    def test_uses_the_space_key(self):
        assert project_identifier("IMS", taken=set()) == "IMS"

    def test_strips_characters_the_identifier_rule_rejects(self):
        identifier = project_identifier("my-space.1", taken=set())

        assert identifier == "MYSPACE1"
        assert not Project.has_forbidden_identifier_chars(identifier)

    def test_truncates_to_the_column_limit(self):
        assert project_identifier("ABCDEFGHIJKLMNOP", taken=set()) == "ABCDEFGHIJ"

    def test_suffixes_on_collision(self):
        assert project_identifier("IMS", taken={"IMS"}) == "IMS2"
        assert project_identifier("IMS", taken={"IMS", "IMS2"}) == "IMS3"

    def test_suffix_respects_the_length_limit(self):
        identifier = project_identifier("ABCDEFGHIJKLMNOP", taken={"ABCDEFGHIJ"})

        assert identifier == "ABCDEFGHI2"
        assert len(identifier) == 10

    def test_empty_key_still_produces_something_valid(self):
        assert project_identifier("", taken=set()) == "WIKI"
