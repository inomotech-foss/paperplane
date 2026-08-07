# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.utils.content_validator import _compute_html_sanitization_diff, validate_html_content

# One block per editor node/mark that renders custom tags or attributes, using
# the markup the editor actually emits. The sanitiser must round-trip all of it:
# anything stripped here is silently lost on every page and work-item write.
EDITOR_DOCUMENT = """
<h2 id="c9b2b1e0-0000-4000-8000-000000000001">Heading</h2>
<p style="text-align: center">Aligned</p>
<p><span data-comment-thread-id="c9b2b1e0-0000-4000-8000-000000000002"
   data-comment-resolved="true" class="comment-mark">commented</span></p>
<ul data-type="taskList">
  <li data-checked="true" data-type="taskItem">
    <label><input type="checkbox" checked><span></span></label>
    <div><p>done</p></div>
  </li>
</ul>
<table>
  <colgroup><col style="width: 150px"><col></colgroup>
  <tbody>
    <tr>
      <th colspan="1" rowspan="1" colwidth="150" background="#ff0000">H</th>
      <td colspan="1" rowspan="1" background="#00ff00" textColor="#000000">C</td>
    </tr>
  </tbody>
</table>
<image-component id="c9b2b1e0-0000-4000-8000-000000000003" src="asset-id" width="35%"
  height="auto" aspectratio="1.5" alignment="center"></image-component>
<mention-component id="c9b2b1e0-0000-4000-8000-000000000004"
  entity_identifier="c9b2b1e0-0000-4000-8000-000000000005"
  entity_name="user_mention"></mention-component>
<issue-embed-component id="c9b2b1e0-0000-4000-8000-000000000006"
  entity_identifier="c9b2b1e0-0000-4000-8000-000000000007"
  project_identifier="c9b2b1e0-0000-4000-8000-000000000008"
  workspace_identifier="c9b2b1e0-0000-4000-8000-000000000009"
  entity_name="issue_embed"></issue-embed-component>
<div class="callout-component" data-block-type="callout-component" data-logo-in-use="emoji"
  data-emoji-unicode="128512" data-emoji-url="https://cdn.test/e.png" data-icon-name="Info"
  data-icon-color="#3f76ff" data-background="#ffffff"><p>callout</p></div>
<pre language="python"><code language="python" spellcheck="false">x = 1</code></pre>
<p><span data-text-color="red" data-background-color="blue">coloured</span></p>
<p>Jump target<anchor-component name="section-1" id="section-1" data-anchor="section-1"></anchor-component></p>
<toc-component min-level="2" max-level="5"></toc-component>
<child-pages-component depth="10"></child-pages-component>
<blockquote><p>quote</p></blockquote>
<p><code spellcheck="false">inline</code></p>
"""


@pytest.mark.unit
class TestEditorHTMLRoundTrip:
    """The allowlist is hand-maintained and drifts behind the editor schema.

    nh3 has no data-* wildcard, so a node or attribute added to the editor and
    not mirrored here is dropped on write with no error.
    """

    def test_editor_document_survives_sanitisation(self):
        is_valid, error, clean = validate_html_content(EDITOR_DOCUMENT)

        assert is_valid, error
        diff = _compute_html_sanitization_diff(EDITOR_DOCUMENT, clean)
        assert diff["removed_tags"] == {}, f"sanitiser dropped tags: {diff['removed_tags']}"
        assert diff["removed_attributes"] == {}, f"sanitiser dropped attributes: {diff['removed_attributes']}"

    def test_relative_and_fragment_hrefs_survive(self):
        """Internal page links and in-page anchors must not be rewritten away."""
        html = '<p><a href="/workspace/projects/1/pages/2/">page</a> <a href="#heading-id">anchor</a></p>'

        _, _, clean = validate_html_content(html)

        assert 'href="/workspace/projects/1/pages/2/"' in clean
        assert 'href="#heading-id"' in clean


@pytest.mark.unit
class TestScriptStripping:
    @pytest.mark.parametrize(
        "html",
        [
            "<p>ok</p><script>alert(1)</script>",
            '<p><img src="x" onerror="alert(1)"></p>',
            '<p><a href="javascript:alert(1)">x</a></p>',
            '<iframe src="https://evil.test"></iframe>',
        ],
    )
    def test_dangerous_content_is_removed(self, html):
        _, _, clean = validate_html_content(html)

        assert "script" not in clean
        assert "onerror" not in clean
        assert "javascript:" not in clean
        assert "iframe" not in clean
