# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.confluence import (
    ResolvedAttachment,
    ResolvedPage,
    ResolvedUser,
    Resolvers,
    storage_to_html,
)

USER_ID = "11111111-1111-4111-8111-111111111111"
IMAGE_ID = "22222222-2222-4222-8222-222222222222"
PDF_ID = "33333333-3333-4333-8333-333333333333"
DIAGRAM_ID = "44444444-4444-4444-8444-444444444444"
DIAGRAM_PNG_ID = "55555555-5555-4555-8555-555555555555"


@pytest.fixture
def resolvers():
    return Resolvers(
        users={"acct-1": ResolvedUser(id=USER_ID, display_name="Ada Lovelace")},
        attachments={
            "diagram.png": ResolvedAttachment(id=IMAGE_ID, filename="diagram.png", is_image=True),
            "spec.pdf": ResolvedAttachment(id=PDF_ID, filename="spec.pdf", is_image=False, url="/assets/spec.pdf"),
            "Flow.drawio": ResolvedAttachment(id=DIAGRAM_ID, filename="Flow.drawio", is_image=False),
            "Flow.drawio.png": ResolvedAttachment(id=DIAGRAM_PNG_ID, filename="Flow.drawio.png", is_image=True),
        },
        pages={("QA", "Test Plan"): ResolvedPage(id="p1", url="/w/projects/p/pages/1/", title="Test Plan")},
    )


def convert(body, resolvers=None):
    return storage_to_html(body, resolvers)


@pytest.mark.unit
class TestProse:
    def test_plain_markup_round_trips(self):
        result = convert("<h1>Title</h1><p>Body with <strong>bold</strong>.</p>")

        assert result.html == "<h1>Title</h1><p>Body with <strong>bold</strong>.</p>"
        assert result.is_lossless

    def test_entities_are_decoded(self):
        assert "Überblick" in convert("<p>&Uuml;berblick</p>").html

    def test_empty_body_gives_an_empty_paragraph(self):
        assert convert("").html == "<p></p>"


@pytest.mark.unit
class TestImages:
    def test_image_becomes_an_image_component(self, resolvers):
        body = '<ac:image ac:align="center" ac:width="400"><ri:attachment ri:filename="diagram.png"/></ac:image>'

        html = convert(body, resolvers).html

        assert f'src="{IMAGE_ID}"' in html
        assert f'id="{IMAGE_ID}"' in html
        assert 'alignment="center"' in html
        assert 'width="400px"' in html
        assert "[image]" not in html

    def test_unresolved_image_keeps_its_filename(self, resolvers):
        result = convert('<ac:image><ri:attachment ri:filename="missing.png"/></ac:image>', resolvers)

        assert "[missing.png]" in result.html
        assert result.unresolved_attachments == {"missing.png"}

    def test_external_image_becomes_an_img(self, resolvers):
        html = convert('<ac:image><ri:url ri:value="https://x.test/a.png"/></ac:image>', resolvers).html

        assert '<img src="https://x.test/a.png"/>' in html


@pytest.mark.unit
class TestMentions:
    def test_mention_becomes_a_mention_component(self, resolvers):
        html = convert('<p><ac:link><ri:user ri:account-id="acct-1"/></ac:link></p>', resolvers).html

        assert f'entity_identifier="{USER_ID}"' in html
        assert 'entity_name="user_mention"' in html
        assert "<strong>" not in html

    def test_unknown_account_is_recorded(self, resolvers):
        result = convert('<p><ac:link><ri:user ri:account-id="ghost"/></ac:link></p>', resolvers)

        assert result.unresolved_users == {"ghost"}
        assert "@unknown" in result.html


@pytest.mark.unit
class TestLinks:
    def test_page_link_resolves_to_a_plane_url(self, resolvers):
        body = (
            '<p><ac:link><ri:page ri:space-key="QA" ri:content-title="Test Plan"/>'
            "<ac:link-body>the plan</ac:link-body></ac:link></p>"
        )

        html = convert(body, resolvers).html

        assert '<a href="/w/projects/p/pages/1/">the plan</a>' in html

    def test_unresolved_page_link_keeps_its_label(self, resolvers):
        body = '<p><ac:link><ri:page ri:content-title="Gone"/><ac:link-body>see this</ac:link-body></ac:link></p>'

        result = convert(body, resolvers)

        assert "see this" in result.html
        assert result.unresolved_pages == {"Gone"}

    def test_attachment_link_points_at_the_asset(self, resolvers):
        body = '<p><ac:link><ri:attachment ri:filename="spec.pdf"/></ac:link></p>'

        assert '<a href="/assets/spec.pdf">spec.pdf</a>' in convert(body, resolvers).html

    def test_anchor_link_becomes_a_fragment(self, resolvers):
        body = '<p><ac:link ac:anchor="Section1"><ac:link-body>jump</ac:link-body></ac:link></p>'

        assert '<a href="#Section1">jump</a>' in convert(body, resolvers).html


@pytest.mark.unit
class TestTaskLists:
    def test_tasks_become_native_checkboxes(self):
        body = (
            "<ac:task-list><ac:task><ac:task-id>1</ac:task-id>"
            "<ac:task-status>complete</ac:task-status>"
            "<ac:task-body>Ship it</ac:task-body></ac:task>"
            "<ac:task><ac:task-id>2</ac:task-id><ac:task-status>incomplete</ac:task-status>"
            "<ac:task-body>Write it</ac:task-body></ac:task></ac:task-list>"
        )

        html = convert(body).html

        assert '<ul data-type="taskList">' in html
        assert 'data-checked="true"' in html
        assert 'data-checked="false"' in html
        assert 'checked="checked"' in html
        assert "Ship it" in html and "Write it" in html
        assert "[x]" not in html and "[ ]" not in html

    def test_nested_task_lists_are_preserved(self):
        body = (
            "<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status>"
            "<ac:task-body>outer</ac:task-body></ac:task>"
            "<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status>"
            "<ac:task-body>inner</ac:task-body></ac:task></ac:task-list></ac:task-list>"
        )

        html = convert(body).html

        assert html.count('data-type="taskList"') == 2
        assert "outer" in html and "inner" in html


@pytest.mark.unit
class TestTables:
    def test_highlight_colour_maps_onto_the_cell_background(self):
        body = (
            '<table data-layout="wide"><colgroup><col style="width: 133.0px;"/></colgroup>'
            '<tbody><tr><th data-highlight-colour="#fffae6"><p>H</p></th></tr></tbody></table>'
        )

        result = convert(body)

        assert 'background="#fffae6"' in result.html
        assert 'colwidth="133"' in result.html
        assert "data-highlight-colour" not in result.html
        assert "data-layout" not in result.html
        assert result.dropped_layouts == 1

    def test_default_layout_is_not_counted_as_a_loss(self):
        result = convert('<table data-layout="default"><tbody><tr><td>c</td></tr></tbody></table>')

        assert result.dropped_layouts == 0


@pytest.mark.unit
class TestMacros:
    def test_code_macro_becomes_a_code_block(self):
        body = (
            '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">python</ac:parameter>'
            "<ac:plain-text-body>x = 1</ac:plain-text-body></ac:structured-macro>"
        )

        html = convert(body).html

        assert '<pre language="python">' in html
        assert '<code language="python">x = 1</code>' in html

    def test_info_macro_becomes_a_callout(self):
        body = (
            '<ac:structured-macro ac:name="info">'
            "<ac:rich-text-body><p>heads up</p></ac:rich-text-body></ac:structured-macro>"
        )

        html = convert(body).html

        assert 'data-block-type="callout-component"' in html
        assert "<p>heads up</p>" in html

    def test_anchor_macro_becomes_an_anchor_node(self):
        body = (
            '<ac:structured-macro ac:name="anchor">'
            '<ac:parameter ac:name="">ASPICE_WP_01-00</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert '<anchor-component name="ASPICE_WP_01-00"></anchor-component>' in result.html
        assert result.unsupported_macros == {}

    def test_toc_macro_becomes_a_toc_node(self):
        body = (
            '<ac:structured-macro ac:name="toc"><ac:parameter ac:name="minLevel">2</ac:parameter>'
            '<ac:parameter ac:name="maxLevel">5</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert '<toc-component max-level="5" min-level="2"></toc-component>' in result.html
        assert result.unsupported_macros == {}

    @pytest.mark.parametrize(
        "body,macro",
        [
            ('<ac:structured-macro ac:name="children"/>', "children"),
            (
                '<ac:structured-macro ac:name="drawio">'
                '<ac:parameter ac:name="diagramName">Flow.drawio</ac:parameter></ac:structured-macro>',
                "drawio",
            ),
        ],
    )
    def test_pending_block_macros_are_dropped_and_counted(self, body, macro, resolvers):
        """Dropped until the matching editor extension exists, but counted so
        the fidelity report shows what the follow-up restores."""
        result = convert(body, resolvers)

        assert result.unsupported_macros == {macro: 1}
        assert result.html == "<p></p>"

    def test_dynamic_macros_are_recorded_not_silently_dropped(self):
        body = (
            '<ac:structured-macro ac:name="change-history"/>'
            '<ac:structured-macro ac:name="tasks-report"/>'
            '<ac:structured-macro ac:name="change-history"/>'
        )

        result = convert(body)

        assert result.unsupported_macros == {"change-history": 2, "tasks-report": 1}
        assert "change-history" not in result.html

    def test_unknown_macro_keeps_its_rich_text_body(self):
        body = (
            '<ac:structured-macro ac:name="expand">'
            "<ac:rich-text-body><p>hidden</p></ac:rich-text-body></ac:structured-macro>"
        )

        result = convert(body)

        assert "<p>hidden</p>" in result.html
        assert result.unsupported_macros == {}

    def test_nested_macro_body_survives_the_outer_macro(self):
        body = (
            '<ac:structured-macro ac:name="info"><ac:rich-text-body>'
            '<ac:structured-macro ac:name="code"><ac:plain-text-body>y = 2</ac:plain-text-body></ac:structured-macro>'
            "</ac:rich-text-body></ac:structured-macro>"
        )

        html = convert(body).html

        assert "<code>y = 2</code>" in html
        assert 'data-block-type="callout-component"' in html


@pytest.mark.unit
class TestAdfAndLayout:
    def test_adf_extension_uses_its_rendered_fallback(self):
        body = (
            '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-content><p>adf</p></ac:adf-content>'
            '</ac:adf-node><ac:adf-fallback><div class="panel"><p>rendered</p></div></ac:adf-fallback>'
            "</ac:adf-extension>"
        )

        html = convert(body).html

        assert "<p>rendered</p>" in html
        assert "adf-extension" not in html

    def test_empty_adf_node_is_recorded(self):
        body = '<ac:adf-extension><ac:adf-node type="decision-list"/></ac:adf-extension>'

        assert convert(body).unsupported_macros == {"adf:decision-list": 1}

    def test_multi_column_layout_is_flattened_and_recorded(self):
        body = (
            "<ac:layout><ac:layout-section><ac:layout-cell><p>left</p></ac:layout-cell>"
            "<ac:layout-cell><p>right</p></ac:layout-cell></ac:layout-section></ac:layout>"
        )

        result = convert(body)

        assert result.html == "<p>left</p><p>right</p>"
        assert result.dropped_layouts == 1

    def test_single_column_layout_is_not_a_loss(self):
        body = (
            "<ac:layout><ac:layout-section><ac:layout-cell><p>only</p></ac:layout-cell></ac:layout-section></ac:layout>"
        )

        result = convert(body)

        assert result.html == "<p>only</p>"
        assert result.dropped_layouts == 0


@pytest.mark.unit
class TestInlineNodes:
    @pytest.mark.parametrize(
        "attribute,expected",
        [('ac:emoji-fallback="\\uD83D\\uDDD3"', "🗓"), ('ac:emoji-fallback="✅"', "✅")],
    )
    def test_emoticons_become_characters(self, attribute, expected):
        assert expected in convert(f"<p><ac:emoticon {attribute}/></p>").html

    def test_emoticon_without_a_fallback_uses_its_shortname(self):
        assert ":smile:" in convert('<p><ac:emoticon ac:emoji-shortname=":smile:"/></p>').html

    def test_time_node_becomes_its_date(self):
        assert convert('<p><time datetime="2023-02-02"/></p>').html == "<p>2023-02-02</p>"

    def test_placeholders_are_dropped(self):
        body = "<p><ac:placeholder>Type something here</ac:placeholder>real</p>"

        html = convert(body).html

        assert "Type something here" not in html
        assert "real" in html

    def test_placeholder_only_paragraph_leaves_no_blank_line(self):
        body = "<p>before</p><p><ac:placeholder>List participants</ac:placeholder></p><p>after</p>"

        assert convert(body).html == "<p>before</p><p>after</p>"

    def test_inline_comment_markers_keep_their_text(self):
        body = '<p><ac:inline-comment-marker ac:ref="abc">reviewed</ac:inline-comment-marker></p>'

        assert convert(body).html == "<p>reviewed</p>"


@pytest.mark.unit
class TestResidualMarkup:
    def test_no_confluence_namespace_survives(self, resolvers):
        body = '<p><ac:unknown-thing ac:foo="1">kept</ac:unknown-thing></p><p ac:local-id="x">also kept</p>'

        html = convert(body, resolvers).html

        assert "ac:" not in html
        assert "ri:" not in html
        assert "kept" in html and "also kept" in html
