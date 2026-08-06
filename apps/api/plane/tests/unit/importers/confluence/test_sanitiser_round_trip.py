# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.confluence import storage_to_html
from plane.utils.content_validator import _compute_html_sanitization_diff, validate_html_content

# Blocks the converter emits for macros whose editor extension is not built
# yet. They are stripped on write until then; drop entries from this set as
# each extension lands.
PENDING_NODES = {"anchor-component", "child-pages-component", "toc-component", "diagram-component"}

SUPPORTED_CONSTRUCTS = """
<h1>Heading</h1>
<p>Prose with <strong>bold</strong> and <em>italic</em>.</p>
<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">python</ac:parameter>
  <ac:plain-text-body>x = 1</ac:plain-text-body></ac:structured-macro>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>heads up</p></ac:rich-text-body></ac:structured-macro>
<ac:task-list><ac:task><ac:task-status>complete</ac:task-status>
  <ac:task-body>done</ac:task-body></ac:task></ac:task-list>
<table data-layout="wide"><colgroup><col style="width: 120.0px;"/></colgroup>
  <tbody><tr><th data-highlight-colour="#fffae6"><p>H</p></th></tr></tbody></table>
<p><ac:emoticon ac:emoji-fallback="✅"/> <time datetime="2024-01-01"/></p>
<ul><li><p>list item</p></li></ul>
<blockquote><p>quote</p></blockquote>
"""


@pytest.mark.unit
class TestConverterOutputSurvivesTheSanitiser:
    """Converter output is written through validate_html_content, so anything
    it strips is lost before the page is ever opened."""

    def test_supported_constructs_are_not_stripped(self):
        html = storage_to_html(SUPPORTED_CONSTRUCTS).html

        is_valid, error, clean = validate_html_content(html)

        assert is_valid, error
        diff = _compute_html_sanitization_diff(html, clean)
        assert diff["removed_tags"] == {}
        assert diff["removed_attributes"] == {}

    @pytest.mark.parametrize(
        "body,node",
        [
            ('<ac:structured-macro ac:name="toc"/>', "toc-component"),
            ('<ac:structured-macro ac:name="children"/>', "child-pages-component"),
            (
                '<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">A</ac:parameter></ac:structured-macro>',
                "anchor-component",
            ),
        ],
    )
    def test_pending_nodes_are_still_pending(self, body, node):
        """Fails once the extension lands, as the reminder to allowlist it."""
        html = storage_to_html(body).html
        _, _, clean = validate_html_content(html)

        assert node in html
        assert node in PENDING_NODES
        assert node not in clean
