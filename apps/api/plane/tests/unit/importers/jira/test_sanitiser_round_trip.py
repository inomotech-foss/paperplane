# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.jira.adf import adf_to_html
from plane.utils.content_validator import _compute_html_sanitization_diff, validate_html_content

from .test_adf import MARKS, NODES, RESOLVERS, doc


@pytest.mark.unit
class TestConverterOutputSurvivesTheSanitiser:
    """Converter output is written through validate_html_content, so anything
    it strips is lost before the issue is ever opened."""

    def test_nothing_the_converter_emits_is_stripped(self):
        fixtures = list(NODES.values()) + list(MARKS.values())
        document = doc(*(fixture[0]["content"][0] for fixture in fixtures))

        html = adf_to_html(document, RESOLVERS).html

        is_valid, error, clean = validate_html_content(html)
        assert is_valid, error
        diff = _compute_html_sanitization_diff(html, clean)
        assert diff["removed_tags"] == {}
        assert diff["removed_attributes"] == {}
