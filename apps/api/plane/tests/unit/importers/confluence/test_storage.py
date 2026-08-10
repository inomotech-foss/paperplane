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

DRAWIO_MACRO = (
    '<ac:structured-macro ac:name="drawio">'
    '<ac:parameter ac:name="diagramName">Flow.drawio</ac:parameter></ac:structured-macro>'
)


def _drawio_resolvers(filename, asset_id):
    """Only one half of the draw.io attachment pair is present."""
    return Resolvers(
        attachments={filename: ResolvedAttachment(id=asset_id, filename=filename, is_image=True)},
    )


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
        assert result.downgraded == {"table-width": 1}
        assert result.is_lossless

    def test_default_layout_is_not_counted_at_all(self):
        result = convert('<table data-layout="default"><tbody><tr><td>c</td></tr></tbody></table>')

        assert result.downgraded == {}


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
        "parameters,depth",
        [
            ("", "1"),
            ('<ac:parameter ac:name="depth">10</ac:parameter>', "10"),
            ('<ac:parameter ac:name="depth">500</ac:parameter>', "20"),
            ('<ac:parameter ac:name="depth">nonsense</ac:parameter>', "1"),
            ('<ac:parameter ac:name="all">true</ac:parameter>', "20"),
            ('<ac:parameter ac:name="sort">title</ac:parameter>', "1"),
        ],
    )
    def test_children_macro_becomes_a_child_pages_node(self, parameters, depth):
        body = f'<ac:structured-macro ac:name="children">{parameters}</ac:structured-macro>'

        result = convert(body)

        assert f'<child-pages-component depth="{depth}"></child-pages-component>' in result.html
        assert result.unsupported_macros == {}

    def test_children_macro_targeting_another_page_is_recorded(self):
        """The block only knows about the page it sits on."""
        body = (
            '<ac:structured-macro ac:name="children">'
            '<ac:parameter ac:name="page"><ac:link><ri:page ri:content-title="Other"/></ac:link>'
            "</ac:parameter></ac:structured-macro>"
        )

        result = convert(body)

        assert "child-pages-component" not in result.html
        assert result.unsupported_macros == {"children": 1}

    @pytest.mark.parametrize(
        "parameters",
        ["", '<ac:parameter ac:name="sortBy">date</ac:parameter><ac:parameter ac:name="upload">true</ac:parameter>'],
    )
    def test_attachments_macro_becomes_a_page_attachments_node(self, parameters):
        body = f'<ac:structured-macro ac:name="attachments">{parameters}</ac:structured-macro>'

        result = convert(body)

        assert "<page-attachments-component></page-attachments-component>" in result.html
        assert result.unsupported_macros == {}

    def test_drawio_macro_becomes_a_diagram_node(self, resolvers):
        body = (
            '<ac:structured-macro ac:name="drawio">'
            '<ac:parameter ac:name="diagramName">Flow.drawio</ac:parameter>'
            '<ac:parameter ac:name="diagramDisplayName">Release Flow.drawio</ac:parameter>'
            '<ac:parameter ac:name="width">1872</ac:parameter>'
            '<ac:parameter ac:name="height">982</ac:parameter>'
            '<ac:parameter ac:name="zoom">0.99</ac:parameter></ac:structured-macro>'
        )

        result = convert(body, resolvers)

        # BeautifulSoup writes attributes alphabetically, not in insertion order.
        assert result.html == (
            f'<diagram-component asset_id="{DIAGRAM_ID}" height="982" '
            f'preview_asset_id="{DIAGRAM_PNG_ID}" title="Release Flow.drawio" '
            'width="1872"></diagram-component>'
        )
        assert result.is_lossless

    def test_drawio_macro_falls_back_to_the_source_name_for_its_title(self, resolvers):
        assert 'title="Flow.drawio"' in convert(DRAWIO_MACRO, resolvers).html

    def test_drawio_macro_keeps_a_diagram_that_lost_its_preview(self):
        """A source without a preview still renders, as a titled placeholder,
        and stays editable once the diagram editor lands."""
        result = convert(DRAWIO_MACRO, _drawio_resolvers("Flow.drawio", DIAGRAM_ID))

        assert f' asset_id="{DIAGRAM_ID}"' in result.html
        assert "preview_asset_id" not in result.html
        assert result.unresolved_attachments == {"Flow.drawio.png"}

    def test_drawio_macro_keeps_a_preview_whose_source_is_gone(self):
        result = convert(DRAWIO_MACRO, _drawio_resolvers("Flow.drawio.png", DIAGRAM_PNG_ID))

        assert f'preview_asset_id="{DIAGRAM_PNG_ID}"' in result.html
        assert " asset_id=" not in result.html
        assert result.unresolved_attachments == {"Flow.drawio"}

    def test_drawio_macro_with_no_attachments_degrades_to_its_name(self):
        result = convert(DRAWIO_MACRO)

        assert result.html == "[Flow.drawio]"
        assert result.unresolved_attachments == {"Flow.drawio"}
        assert result.unsupported_macros == {}

    def test_drawio_macro_without_a_diagram_name_is_recorded(self, resolvers):
        body = (
            '<ac:structured-macro ac:name="drawio"><ac:parameter ac:name="zoom">1</ac:parameter></ac:structured-macro>'
        )

        result = convert(body, resolvers)

        assert "diagram-component" not in result.html
        assert result.unsupported_macros == {"drawio": 1}

    @pytest.mark.parametrize("macro_name", ["drawio-sketch", "inc-drawio"])
    def test_drawio_variants_use_the_same_conversion(self, macro_name, resolvers):
        body = (
            f'<ac:structured-macro ac:name="{macro_name}">'
            '<ac:parameter ac:name="diagramName">Flow.drawio</ac:parameter></ac:structured-macro>'
        )

        result = convert(body, resolvers)

        assert f'asset_id="{DIAGRAM_ID}"' in result.html
        assert result.is_lossless

    def test_view_file_macro_becomes_a_download_link(self, resolvers):
        body = (
            '<ac:structured-macro ac:name="view-file"><ac:parameter ac:name="name">'
            '<ri:attachment ri:filename="spec.pdf" ri:version-at-save="1"/>'
            "</ac:parameter></ac:structured-macro>"
        )

        result = convert(body, resolvers)

        assert result.html == '<a href="/assets/spec.pdf">spec.pdf</a>'
        assert result.is_lossless

    def test_view_file_macro_renders_an_image_inline(self, resolvers):
        body = (
            '<ac:structured-macro ac:name="viewxls"><ac:parameter ac:name="name">'
            '<ri:attachment ri:filename="diagram.png"/></ac:parameter></ac:structured-macro>'
        )

        result = convert(body, resolvers)

        assert result.html == f'<image-component id="{IMAGE_ID}" src="{IMAGE_ID}"></image-component>'
        assert result.is_lossless

    def test_view_file_macro_records_an_attachment_it_cannot_find(self, resolvers):
        body = (
            '<ac:structured-macro ac:name="view-file"><ac:parameter ac:name="name">'
            '<ri:attachment ri:filename="missing.pdf"/></ac:parameter></ac:structured-macro>'
        )

        result = convert(body, resolvers)

        assert result.html == "missing.pdf"
        assert result.unresolved_attachments == {"missing.pdf"}

    def test_view_file_macro_pointing_at_a_page_is_recorded(self, resolvers):
        """A few name another page instead of a file, which the page's own
        attachment map cannot answer."""
        body = (
            '<ac:structured-macro ac:name="view-file"><ac:parameter ac:name="name">'
            '<ri:page ri:content-title="Test Plan"/></ac:parameter></ac:structured-macro>'
        )

        result = convert(body, resolvers)

        assert result.unsupported_macros == {"view-file": 1}

    def test_profile_macro_becomes_a_mention(self, resolvers):
        body = (
            '<ac:structured-macro ac:name="profile"><ac:parameter ac:name="user">'
            '<ri:user ri:account-id="acct-1"/></ac:parameter></ac:structured-macro>'
        )

        result = convert(body, resolvers)

        assert f'entity_identifier="{USER_ID}"' in result.html
        assert result.is_lossless

    @pytest.mark.parametrize("macro_name", ["include", "excerpt-include"])
    def test_include_macro_becomes_a_link_to_the_page(self, macro_name, resolvers):
        """Transclusion is not reproduced; the reference is."""
        body = (
            f'<ac:structured-macro ac:name="{macro_name}"><ac:parameter ac:name="">'
            '<ac:link><ri:page ri:content-title="Test Plan" ri:space-key="QA"/></ac:link>'
            "</ac:parameter></ac:structured-macro>"
        )

        result = convert(body, resolvers)

        assert result.html == '<a href="/w/projects/p/pages/1/">Test Plan</a>'
        assert result.is_lossless

    def test_include_macro_without_a_reference_is_recorded(self, resolvers):
        result = convert('<ac:structured-macro ac:name="include"/>', resolvers)

        assert result.unsupported_macros == {"include": 1}

    def test_dynamic_macros_are_recorded_not_silently_dropped(self):
        body = (
            '<ac:structured-macro ac:name="livesearch"/>'
            '<ac:structured-macro ac:name="tasks-report"/>'
            '<ac:structured-macro ac:name="livesearch"/>'
        )

        result = convert(body)

        assert result.unsupported_macros == {"livesearch": 2, "tasks-report": 1}
        assert "livesearch" not in result.html

    def test_chrome_macros_are_dropped_without_counting_as_loss(self):
        body = '<ac:structured-macro ac:name="change-history"/><ac:structured-macro ac:name="create-from-template"/>'

        result = convert(body)

        assert result.dropped_chrome == {"change-history": 1, "create-from-template": 1}
        assert result.unsupported_macros == {}
        assert result.is_lossless

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
class TestJiraMacros:
    def _jira_macro(self, server_id="", key="", jql_query=""):
        parameters = []
        if server_id:
            parameters.append(f'<ac:parameter ac:name="serverId">{server_id}</ac:parameter>')
        if key:
            parameters.append(f'<ac:parameter ac:name="key">{key}</ac:parameter>')
        if jql_query:
            parameters.append(f'<ac:parameter ac:name="jqlQuery">{jql_query}</ac:parameter>')
        return f'<ac:structured-macro ac:name="jira">{"".join(parameters)}</ac:structured-macro>'

    def _jira_resolvers(self):
        return Resolvers(jira_base_urls={"server-1": "https://example.atlassian.net"})

    def test_key_becomes_a_browse_link(self):
        body = self._jira_macro(server_id="server-1", key="ABC-123")

        result = convert(body, self._jira_resolvers())

        assert result.html == '<a href="https://example.atlassian.net/browse/ABC-123">ABC-123</a>'
        assert result.downgraded == {"jira": 1}
        assert result.is_lossless

    def test_key_with_an_unmapped_server_id_keeps_the_bare_key(self):
        body = self._jira_macro(server_id="unknown-server", key="ABC-123")

        result = convert(body, self._jira_resolvers())

        assert result.html == "ABC-123"
        assert result.downgraded == {"jira": 1}
        assert result.is_lossless

    def test_enumerated_jql_becomes_one_link_per_key(self):
        body = self._jira_macro(server_id="server-1", jql_query="key in ('ABC-1', \"ABC-2\")")

        result = convert(body, self._jira_resolvers())

        assert result.html == (
            '<a href="https://example.atlassian.net/browse/ABC-1">ABC-1</a>, '
            '<a href="https://example.atlassian.net/browse/ABC-2">ABC-2</a>'
        )
        assert result.downgraded == {"jira": 1}
        assert result.is_lossless

    def test_arbitrary_jql_becomes_a_search_link(self):
        body = self._jira_macro(server_id="server-1", jql_query="project = ABC AND status = Open")

        result = convert(body, self._jira_resolvers())

        assert result.html == (
            '<a href="https://example.atlassian.net/issues/?jql='
            "project%20%3D%20ABC%20AND%20status%20%3D%20Open"
            '">project = ABC AND status = Open</a>'
        )
        assert result.downgraded == {"jira": 1}
        assert result.is_lossless

    def test_macro_with_neither_parameter_is_recorded(self):
        body = self._jira_macro(server_id="server-1")

        result = convert(body, self._jira_resolvers())

        assert "jira" not in result.html
        assert result.unsupported_macros == {"jira": 1}
        assert not result.is_lossless


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
        body = '<ac:adf-extension><ac:adf-node type="expand"/></ac:adf-extension>'

        assert convert(body).unsupported_macros == {"adf:expand": 1}

    def test_adf_container_keeps_every_body_not_just_the_first(self):
        """One body per child, so taking only the first dropped the rest
        without recording anything."""
        body = (
            '<ac:adf-extension><ac:adf-node type="expand">'
            '<ac:adf-node type="panel"><ac:adf-content><p>first</p></ac:adf-content></ac:adf-node>'
            '<ac:adf-node type="panel"><ac:adf-content><p>second</p></ac:adf-content></ac:adf-node>'
            "</ac:adf-node></ac:adf-extension>"
        )

        result = convert(body)

        assert result.html == "<p>first</p><p>second</p>"
        assert result.is_lossless

    def test_decision_list_becomes_a_ticked_checkbox_list(self):
        body = (
            '<ac:adf-extension><ac:adf-node type="decision-list">'
            '<ac:adf-attribute key="local-id">abc</ac:adf-attribute>'
            '<ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute>'
            "<ac:adf-content>Ship on Friday</ac:adf-content></ac:adf-node>"
            '<ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute>'
            "<ac:adf-content>Skip the beta</ac:adf-content></ac:adf-node>"
            "</ac:adf-node>"
            "<ac:adf-fallback><ul><li>Ship on Friday</li><li>Skip the beta</li></ul></ac:adf-fallback>"
            "</ac:adf-extension>"
        )

        result = convert(body)

        assert result.html.count('data-type="taskItem"') == 2
        assert result.html.count('data-checked="true"') == 2
        assert "Ship on Friday" in result.html
        assert "Skip the beta" in result.html
        assert result.is_lossless

    def test_empty_decision_list_carries_nothing(self):
        """The widget prompting for a first decision holds no content, so
        dropping it loses nothing and is not recorded."""
        body = (
            '<ac:adf-extension><ac:adf-node type="decision-list">'
            '<ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute>'
            "</ac:adf-node></ac:adf-node></ac:adf-extension>"
        )

        result = convert(body)

        assert "taskItem" not in result.html
        assert result.is_lossless

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
