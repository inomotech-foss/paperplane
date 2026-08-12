# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from dataclasses import dataclass
from urllib.parse import quote

import pytest

from plane.importers.confluence import (
    ResolvedAttachment,
    ResolvedPage,
    ResolvedUser,
    Resolvers,
    storage_to_html,
)
from plane.importers.confluence.jira import derive_base_urls

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

    def test_children_macro_targeting_an_unresolved_page_is_recorded(self):
        """Pointing the block at the current page would show the wrong tree."""
        body = (
            '<ac:structured-macro ac:name="children">'
            '<ac:parameter ac:name="page"><ac:link><ri:page ri:content-title="Other"/></ac:link>'
            "</ac:parameter></ac:structured-macro>"
        )

        result = convert(body)

        assert "child-pages-component" not in result.html
        assert "query-block-component" not in result.html
        assert result.unsupported_macros == {"children": 1}
        assert result.unresolved_pages == {"Other"}

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

    def test_unknown_bodyless_macros_are_recorded_not_silently_dropped(self):
        """A third-party macro with no rich-text body has nothing to unwrap, so
        it would vanish without a trace if it were not counted."""
        body = (
            '<ac:structured-macro ac:name="some-vendor-widget"/>'
            '<ac:structured-macro ac:name="another-widget"/>'
            '<ac:structured-macro ac:name="some-vendor-widget"/>'
        )

        result = convert(body)

        assert result.unsupported_macros == {"some-vendor-widget": 2, "another-widget": 1}
        assert "some-vendor-widget" not in result.html

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


@dataclass
class _Page:
    body: str


@pytest.mark.unit
class TestJiraSiteInference:
    """Confluence records a serverId and never the host, so a backed-up
    project key is the only evidence of which site a server is."""

    SITE = "https://example.atlassian.net"

    def _page(self, server_id, key="", jql_query=""):
        parameters = f'<ac:parameter ac:name="serverId">{server_id}</ac:parameter>'
        if key:
            parameters += f'<ac:parameter ac:name="key">{key}</ac:parameter>'
        if jql_query:
            parameters += f'<ac:parameter ac:name="jqlQuery">{jql_query}</ac:parameter>'
        return _Page(body=f'<ac:structured-macro ac:name="jira">{parameters}</ac:structured-macro>')

    def test_a_backed_up_key_identifies_the_server_it_sits_on(self):
        pages = [self._page("server-1", key="ABC-1")]

        assert derive_base_urls(pages, self.SITE, {"ABC"}) == {"server-1": self.SITE}

    def test_one_match_resolves_every_other_key_on_that_server(self):
        """A serverId names one site, so the rest of its keys follow."""
        pages = [self._page("server-1", key="ABC-1"), self._page("server-1", key="ZZZ-9")]

        assert derive_base_urls(pages, self.SITE, {"ABC"}) == {"server-1": self.SITE}

    def test_a_server_no_key_identifies_is_left_alone(self):
        pages = [self._page("server-2", key="ZZZ-9")]

        assert derive_base_urls(pages, self.SITE, {"ABC"}) == {}

    def test_keys_are_matched_regardless_of_case(self):
        pages = [self._page("server-1", key="abc-1")]

        assert derive_base_urls(pages, self.SITE, {"ABC"}) == {"server-1": self.SITE}

    def test_an_enumerated_jql_query_identifies_a_server_too(self):
        pages = [self._page("server-1", jql_query="key in (ABC-1, ABC-2)")]

        assert derive_base_urls(pages, self.SITE, {"ABC"}) == {"server-1": self.SITE}

    def test_a_backup_with_no_jira_infers_nothing(self):
        pages = [self._page("server-1", key="ABC-1")]

        assert derive_base_urls(pages, "", {"ABC"}) == {}
        assert derive_base_urls(pages, self.SITE, set()) == {}

    def test_a_page_without_a_jira_macro_is_not_parsed(self):
        pages = [_Page(body="<p>prose</p>"), self._page("server-1", key="ABC-1")]

        assert derive_base_urls(pages, self.SITE, {"ABC"}) == {"server-1": self.SITE}


@pytest.mark.unit
class TestRoadmapMacro:
    def _roadmap_macro(self, document, title=""):
        parameters = f'<ac:parameter ac:name="source">{quote(json.dumps(document))}</ac:parameter>'
        if title:
            parameters = f'<ac:parameter ac:name="title">{title}</ac:parameter>{parameters}'
        return f'<ac:structured-macro ac:name="roadmap">{parameters}</ac:structured-macro>'

    def _bar(self, title, start_date, duration, row_index, description=""):
        return {
            "title": title,
            "description": description,
            "startDate": start_date,
            "duration": duration,
            "rowIndex": row_index,
            "id": "bar-1",
            "pageLink": {},
        }

    def test_bars_become_a_table_in_lane_then_row_order(self):
        document = {
            "title": "Roadmap",
            "timeline": {
                "startDate": "2024-01-01 00:00:00",
                "endDate": "2024-06-01 00:00:00",
                "displayOption": "MONTH",
            },
            "lanes": [
                {
                    "title": "Phase one",
                    "color": {},
                    "bars": [
                        self._bar("Discovery", "2024-01-01 00:00:00", 2, 1),
                        self._bar("Kickoff", "2024-01-05 00:00:00", 1, 0),
                    ],
                },
                {"title": "Phase two", "color": {}, "bars": [self._bar("Build", "2024-03-01 00:00:00", 2, 0)]},
            ],
            "markers": [],
        }

        result = convert(self._roadmap_macro(document, "Roadmap"))

        assert result.html == (
            "<p><strong>Roadmap</strong></p><table><tbody>"
            "<tr><th><p>Lane</p></th><th><p>Item</p></th><th><p>Start</p></th>"
            "<th><p>Duration</p></th><th><p>Description</p></th></tr>"
            "<tr><td><p>Phase one</p></td><td><p>Kickoff</p></td><td><p>2024-01-05</p></td>"
            "<td><p>1 month</p></td><td><p></p></td></tr>"
            "<tr><td><p>Phase one</p></td><td><p>Discovery</p></td><td><p>2024-01-01</p></td>"
            "<td><p>2 months</p></td><td><p></p></td></tr>"
            "<tr><td><p>Phase two</p></td><td><p>Build</p></td><td><p>2024-03-01</p></td>"
            "<td><p>2 months</p></td><td><p></p></td></tr>"
            "</tbody></table>"
        )
        assert result.downgraded == {"roadmap": 1}
        assert result.is_lossless

    def test_duration_formatting_rounds_and_pluralizes(self):
        document = {
            "title": "",
            "timeline": {"displayOption": "MONTH"},
            "lanes": [
                {
                    "title": "Phase one",
                    "color": {},
                    "bars": [
                        self._bar("Discovery", "2024-01-01 00:00:00", 2.0099009900990099, 0),
                        self._bar("Wrap up", "2024-02-01 00:00:00", 1, 1),
                    ],
                }
            ],
            "markers": [],
        }

        html = convert(self._roadmap_macro(document)).html

        assert "<p>2.01 months</p>" in html
        assert "<p>1 month</p>" in html

    def test_week_display_option_renders_weeks(self):
        document = {
            "title": "",
            "timeline": {"displayOption": "WEEK"},
            "lanes": [{"title": "Phase one", "color": {}, "bars": [self._bar("Sprint", "2024-01-01 00:00:00", 2, 0)]}],
            "markers": [],
        }

        assert "<p>2 weeks</p>" in convert(self._roadmap_macro(document)).html

    def test_markers_become_a_second_table(self):
        document = {
            "title": "",
            "timeline": {"displayOption": "MONTH"},
            "lanes": [],
            "markers": [{"title": "Milestone A", "markerDate": "2024-03-01 00:00:00"}],
        }

        html = convert(self._roadmap_macro(document)).html

        assert html.count("<table>") == 1
        assert "<th><p>Milestone</p></th><th><p>Date</p></th>" in html
        assert "<p>Milestone A</p>" in html and "<p>2024-03-01</p>" in html

    def test_lane_with_no_bars_still_gets_a_row(self):
        document = {
            "title": "",
            "timeline": {"displayOption": "MONTH"},
            "lanes": [{"title": "Empty phase", "color": {}, "bars": []}],
            "markers": [],
        }

        html = convert(self._roadmap_macro(document)).html

        assert (
            "<tr><td><p>Empty phase</p></td><td><p></p></td><td><p></p></td>"
            "<td><p></p></td><td><p></p></td></tr>" in html
        )

    def test_undecodable_source_is_recorded(self):
        body = (
            '<ac:structured-macro ac:name="roadmap">'
            '<ac:parameter ac:name="source">not-json</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.unsupported_macros == {"roadmap": 1}
        assert not result.is_lossless

    def test_missing_source_is_recorded(self):
        result = convert('<ac:structured-macro ac:name="roadmap"/>')

        assert result.unsupported_macros == {"roadmap": 1}

    def test_empty_roadmap_vanishes_without_recording_anything(self):
        document = {"title": "Roadmap", "timeline": {"displayOption": "MONTH"}, "lanes": [], "markers": []}

        result = convert(self._roadmap_macro(document, "Roadmap"))

        assert result.html == "<p></p>"
        assert result.unsupported_macros == {}
        assert result.downgraded == {}
        assert result.is_lossless


@pytest.mark.unit
class TestEmbedMacros:
    def test_miro_macro_becomes_an_embed(self):
        body = (
            '<ac:structured-macro ac:name="miro-macro">'
            '<ac:parameter ac:name="accessLink">https://miro.com/app/board/abc/</ac:parameter>'
            "</ac:structured-macro>"
        )

        result = convert(body)

        assert result.html == '<embed-component url="https://miro.com/app/board/abc/"></embed-component>'
        assert result.is_lossless
        assert result.downgraded == {}

    def test_iframe_carries_its_nested_url_and_size(self):
        body = (
            '<ac:structured-macro ac:name="iframe">'
            '<ac:parameter ac:name="src"><ri:url ri:value="https://example.com/board"/></ac:parameter>'
            '<ac:parameter ac:name="width">100%</ac:parameter>'
            '<ac:parameter ac:name="height">400</ac:parameter>'
            '<ac:parameter ac:name="frameborder">0</ac:parameter>'
            "</ac:structured-macro>"
        )

        result = convert(body)

        assert result.html == (
            '<embed-component height="400" url="https://example.com/board" width="100%"></embed-component>'
        )
        assert result.is_lossless

    def test_widget_uses_its_own_parameter(self):
        body = (
            '<ac:structured-macro ac:name="widget">'
            '<ac:parameter ac:name="url"><ri:url ri:value="https://example.com/watch"/></ac:parameter>'
            "</ac:structured-macro>"
        )

        assert 'url="https://example.com/watch"' in convert(body).html

    def test_an_embed_without_a_url_is_recorded(self):
        result = convert('<ac:structured-macro ac:name="miro-macro"/>')

        assert result.unsupported_macros == {"miro-macro": 1}
        assert not result.is_lossless


@pytest.mark.unit
class TestMathMacros:
    def test_inline_math_keeps_its_latex(self):
        body = (
            '<p><ac:structured-macro ac:name="eazy-math-inline">'
            '<ac:parameter ac:name="body">a_{0}=\\frac{1}{2}</ac:parameter>'
            "</ac:structured-macro></p>"
        )

        result = convert(body)

        assert result.html == '<p><math-inline-component latex="a_{0}=\\frac{1}{2}"></math-inline-component></p>'
        assert result.is_lossless
        assert result.downgraded == {}

    def test_block_math_uses_the_block_tag(self):
        body = (
            '<ac:structured-macro ac:name="easy-math-block">'
            '<ac:parameter ac:name="body">E=mc^2</ac:parameter>'
            '<ac:parameter ac:name="align">center</ac:parameter>'
            "</ac:structured-macro>"
        )

        assert convert(body).html == '<math-block-component latex="E=mc^2"></math-block-component>'

    def test_math_without_a_body_is_recorded(self):
        result = convert('<ac:structured-macro ac:name="eazy-math-inline"/>')

        assert result.unsupported_macros == {"eazy-math-inline": 1}
        assert not result.is_lossless


@pytest.mark.unit
class TestPlaceholderMacros:
    def test_calendar_macro_becomes_its_bracketed_name(self):
        result = convert('<ac:structured-macro ac:name="calendar"/>')

        assert result.html == "[calendar]"
        assert result.downgraded == {"calendar": 1}
        assert result.is_lossless

    def test_portfolio_macro_with_a_url_becomes_a_link(self):
        body = (
            '<ac:structured-macro ac:name="portfolioforjiraplan">'
            '<ac:parameter ac:name="url">https://example.com/plan</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == '<a href="https://example.com/plan">[portfolioforjiraplan]</a>'
        assert result.downgraded == {"portfolioforjiraplan": 1}
        assert result.is_lossless

    def test_placeholder_macro_inline_in_a_paragraph_stays_inside_it(self):
        body = '<p>See <ac:structured-macro ac:name="gadget"/> for details.</p>'

        html = convert(body).html

        assert html == "<p>See [gadget] for details.</p>"
        assert html.count("<p>") == 1

    def test_onedrive_macro_lists_its_names(self):
        body = (
            '<ac:structured-macro ac:name="onedrive-connector-addon-plugin-for-confluence-macro">'
            '<ac:parameter ac:name="names">["Notes.docx", "Plans"]</ac:parameter>'
            '<ac:parameter ac:name="items">[{"id": "abc"}]</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == "[onedrive: Notes.docx, Plans]"
        assert result.downgraded == {"onedrive-connector-addon-plugin-for-confluence-macro": 1}
        assert result.is_lossless

    def test_onedrive_variant_is_matched_by_its_prefix(self):
        body = (
            '<ac:structured-macro ac:name="onedrive-connector-renamed">'
            '<ac:parameter ac:name="names">["File.txt"]</ac:parameter></ac:structured-macro>'
        )

        assert convert(body).html == "[onedrive: File.txt]"

    def test_onedrive_macro_without_usable_names_is_recorded(self):
        body = '<ac:structured-macro ac:name="onedrive-connector-addon-plugin-for-confluence-macro"/>'

        result = convert(body)

        assert result.unsupported_macros == {"onedrive-connector-addon-plugin-for-confluence-macro": 1}
        assert not result.is_lossless

    def test_requirement_yogi_macro_emits_its_bare_key(self):
        body = (
            '<ac:structured-macro ac:name="requirement-yogi">'
            '<ac:parameter ac:name="reqKey">SYS-004</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == "SYS-004"
        assert result.downgraded == {"requirement-yogi": 1}
        assert result.is_lossless

    def test_requirement_yogi_macro_without_a_key_is_recorded(self):
        result = convert('<ac:structured-macro ac:name="requirement-yogi"/>')

        assert result.unsupported_macros == {"requirement-yogi": 1}

    def test_plantuml_macro_becomes_a_code_block(self):
        body = (
            '<ac:structured-macro ac:name="stepashka-simple-plantuml-macro"><ac:parameter ac:name="diagram">'
            "@startuml\nA -> B\n@enduml</ac:parameter></ac:structured-macro>"
        )

        result = convert(body)

        assert '<pre language="plantuml">' in result.html
        assert '<code language="plantuml">@startuml\nA -&gt; B\n@enduml</code>' in result.html
        assert result.downgraded == {"stepashka-simple-plantuml-macro": 1}
        assert result.is_lossless

    def test_plantuml_macro_without_source_is_recorded(self):
        result = convert('<ac:structured-macro ac:name="stepashka-simple-plantuml-macro"/>')

        assert result.unsupported_macros == {"stepashka-simple-plantuml-macro": 1}


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

    def test_bare_extension_with_a_key_becomes_a_placeholder(self):
        body = (
            '<ac:adf-extension><ac:adf-node type="extension">'
            '<ac:adf-attribute key="extension-key">some-app</ac:adf-attribute>'
            "</ac:adf-node></ac:adf-extension>"
        )

        result = convert(body)

        assert result.html == "[some-app]"
        assert result.downgraded == {"adf:extension": 1}
        assert result.is_lossless

    def test_bare_extension_without_a_key_stays_unsupported(self):
        body = '<ac:adf-extension><ac:adf-node type="extension"/></ac:adf-extension>'

        assert convert(body).unsupported_macros == {"adf:extension": 1}

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

    def test_multi_column_layout_becomes_a_columns_block(self):
        body = (
            '<ac:layout><ac:layout-section ac:type="two_equal"><ac:layout-cell><p>left</p></ac:layout-cell>'
            "<ac:layout-cell><p>right</p></ac:layout-cell></ac:layout-section></ac:layout>"
        )

        result = convert(body)

        assert result.html == (
            '<columns-component layout="1-1"><column-component><p>left</p></column-component>'
            "<column-component><p>right</p></column-component></columns-component>"
        )
        assert result.dropped_layouts == 0
        assert result.is_lossless

    def test_sidebar_layouts_carry_their_ratio(self):
        body = (
            '<ac:layout-section ac:type="three_with_sidebars"><ac:layout-cell><p>a</p></ac:layout-cell>'
            "<ac:layout-cell><p>b</p></ac:layout-cell><ac:layout-cell><p>c</p></ac:layout-cell></ac:layout-section>"
        )

        assert 'layout="1-2-1"' in convert(body).html

    def test_an_empty_cell_still_holds_a_block(self):
        body = (
            '<ac:layout-section ac:type="two_equal"><ac:layout-cell><p>left</p></ac:layout-cell>'
            "<ac:layout-cell/></ac:layout-section>"
        )

        assert convert(body).html.endswith("<column-component><p></p></column-component></columns-component>")

    def test_a_layout_the_mapping_does_not_describe_is_recorded(self):
        body = (
            '<ac:layout-section ac:type="two_equal"><ac:layout-cell><p>a</p></ac:layout-cell>'
            "<ac:layout-cell><p>b</p></ac:layout-cell><ac:layout-cell><p>c</p></ac:layout-cell></ac:layout-section>"
        )

        result = convert(body)

        assert result.html == "<p>a</p><p>b</p><p>c</p>"
        assert result.dropped_layouts == 1

    def test_single_column_layout_is_not_a_loss(self):
        body = (
            '<ac:layout><ac:layout-section ac:type="fixed-width"><ac:layout-cell><p>only</p>'
            "</ac:layout-cell></ac:layout-section></ac:layout>"
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

    @pytest.mark.parametrize("name,expected", [("star_blue", "⭐"), ("check", "✅"), ("smile", "\U0001f642")])
    def test_emoticon_images_become_characters(self, name, expected):
        """The older emoticon is an <img> on a path only Confluence serves, so
        leaving it alone renders a broken image."""
        body = f'<p><img src="/wiki/s/1/2/_/images/icons/emoticons/{name}.png" alt="(x)" width="16"/></p>'

        assert convert(body).html == f"<p>{expected}</p>"

    def test_unknown_emoticon_image_falls_back_to_its_name(self):
        body = '<p><img src="/wiki/s/1/2/_/images/icons/emoticons/party_hat.png" alt="(party)"/></p>'

        assert convert(body).html == "<p>:party_hat:</p>"

    def test_a_real_image_is_left_alone(self):
        """The path has to reach the emoticon directory, not merely look like it."""
        body = '<p><img src="/images/icons/photo.png"/></p>'

        assert convert(body).html == body

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

    def test_smart_link_presentation_hints_are_dropped(self):
        """nh3 strips these on the way to the database, so leaving them in
        makes the sanitiser round-trip lose an attribute silently."""
        body = '<p><a href="https://example.com" data-card-appearance="inline">link</a></p>'

        html = convert(body).html

        assert "data-card-appearance" not in html
        assert 'href="https://example.com"' in html


def _tree_resolvers():
    """The children macro's page parameter carries no space key anywhere in the
    backup, so the map is keyed by bare title the way the report keys it."""
    return Resolvers(pages={"Test Plan": ResolvedPage(id="p1", url="/w/projects/p/pages/1/", title="Test Plan")})


def _report_resolvers():
    """The report macros name pages by Confluence id rather than by title."""
    return Resolvers(pages={("id", "100"): ResolvedPage(id="p1", url="/w/projects/p/pages/1/", title="Test Plan")})


@pytest.mark.unit
class TestQueryBlockMacros:
    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ("", '<query-block-component kind="tree" scope="page"></query-block-component>'),
            (
                '<ac:parameter ac:name="startDepth">3</ac:parameter>',
                '<query-block-component depth="3" kind="tree" scope="page"></query-block-component>',
            ),
            (
                '<ac:parameter ac:name="startDepth">500</ac:parameter>',
                '<query-block-component depth="20" kind="tree" scope="page"></query-block-component>',
            ),
            (
                '<ac:parameter ac:name="startDepth">nonsense</ac:parameter>',
                '<query-block-component kind="tree" scope="page"></query-block-component>',
            ),
            (
                '<ac:parameter ac:name="root"></ac:parameter>',
                '<query-block-component kind="tree" scope="page"></query-block-component>',
            ),
        ],
    )
    def test_pagetree_becomes_a_tree_query(self, parameters, expected):
        body = f'<ac:structured-macro ac:name="pagetree">{parameters}</ac:structured-macro>'

        result = convert(body)

        assert result.html == expected
        assert result.is_lossless

    def test_pagetree_search_box_is_downgraded(self):
        body = (
            '<ac:structured-macro ac:name="pagetree">'
            '<ac:parameter ac:name="searchBox">true</ac:parameter>'
            "</ac:structured-macro>"
        )

        result = convert(body)

        assert 'kind="tree"' in result.html
        assert result.is_lossless
        assert result.downgraded == {"pagetree": 1}

    def test_index_becomes_an_index_query(self):
        body = '<ac:structured-macro ac:name="index"/>'

        result = convert(body)

        assert result.html == '<query-block-component kind="index" scope="project"></query-block-component>'
        assert result.is_lossless

    def test_children_targeting_a_resolvable_page_becomes_a_rooted_tree(self):
        body = (
            '<ac:structured-macro ac:name="children">'
            '<ac:parameter ac:name="page"><ac:link><ri:page ri:content-title="Test Plan"/></ac:link>'
            "</ac:parameter></ac:structured-macro>"
        )

        result = convert(body, _tree_resolvers())

        assert result.html == (
            '<query-block-component kind="tree" root-page-id="p1" scope="workspace"></query-block-component>'
        )
        assert result.is_lossless

    def test_children_targeting_another_page_carries_its_depth(self):
        body = (
            '<ac:structured-macro ac:name="children">'
            '<ac:parameter ac:name="page"><ac:link><ri:page ri:content-title="Test Plan"/></ac:link></ac:parameter>'
            '<ac:parameter ac:name="all">true</ac:parameter>'
            "</ac:structured-macro>"
        )

        result = convert(body, _tree_resolvers())

        assert 'depth="20"' in result.html
        assert result.is_lossless

    @pytest.mark.parametrize("name", ["recently-updated", "recently-updated-dashboard"])
    def test_recently_updated_becomes_a_recent_query(self, name):
        body = (
            f'<ac:structured-macro ac:name="{name}"><ac:parameter ac:name="max">15</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="recent" limit="15" scope="project"></query-block-component>'
        )
        assert result.is_lossless

    def test_recently_updated_across_spaces_widens_the_scope(self):
        body = (
            '<ac:structured-macro ac:name="recently-updated">'
            '<ac:parameter ac:name="spaces">OTHER</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert 'scope="workspace"' in result.html
        assert result.is_lossless

    def test_recently_updated_with_mixed_types_is_downgraded(self):
        body = (
            '<ac:structured-macro ac:name="recently-updated">'
            '<ac:parameter ac:name="types">page, comment, blogpost</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert 'kind="recent"' in result.html
        assert result.is_lossless
        assert result.downgraded == {"recently-updated": 1}

    def test_blog_posts_becomes_a_recent_query(self):
        body = (
            '<ac:structured-macro ac:name="blog-posts">'
            '<ac:parameter ac:name="max">5</ac:parameter>'
            '<ac:parameter ac:name="content">titles</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="recent" limit="5" scope="project"></query-block-component>'
        )
        assert result.is_lossless
        assert result.downgraded == {}

    def test_blog_posts_with_excerpts_is_downgraded(self):
        body = (
            '<ac:structured-macro ac:name="blog-posts">'
            '<ac:parameter ac:name="content">excerpts</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.is_lossless
        assert result.downgraded == {"blog-posts": 1}

    def test_contributors_becomes_a_contributors_query(self):
        body = (
            '<ac:structured-macro ac:name="contributors">'
            '<ac:parameter ac:name="scope">descendants</ac:parameter>'
            '<ac:parameter ac:name="limit">10</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="contributors" limit="10" scope="page"></query-block-component>'
        )
        assert result.is_lossless

    def test_livesearch_becomes_a_search_query(self):
        body = (
            '<ac:structured-macro ac:name="livesearch">'
            '<ac:parameter ac:name="placeholder">Find a runbook</ac:parameter>'
            '<ac:parameter ac:name="size">large</ac:parameter>'
            '<ac:parameter ac:name="type">page</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="search" placeholder="Find a runbook" scope="project"></query-block-component>'
        )
        assert result.is_lossless
        assert result.downgraded == {}

    def test_livesearch_naming_a_space_widens_the_scope(self):
        body = (
            '<ac:structured-macro ac:name="livesearch">'
            '<ac:parameter ac:name="spaceKey">OTHER</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert 'scope="workspace"' in result.html
        assert result.is_lossless

    def test_pagetreesearch_searches_the_current_subtree(self):
        body = '<ac:structured-macro ac:name="pagetreesearch"/>'

        result = convert(body)

        assert result.html == '<query-block-component kind="search" scope="page"></query-block-component>'
        assert result.is_lossless

    def test_pagetreesearch_resolves_a_named_root(self):
        body = (
            '<ac:structured-macro ac:name="pagetreesearch">'
            '<ac:parameter ac:name="rootPage">Test Plan</ac:parameter></ac:structured-macro>'
        )

        result = convert(body, _tree_resolvers())

        assert 'root-page-id="p1"' in result.html
        assert result.is_lossless

    def test_contentbylabel_uses_the_labels_parameter(self):
        body = (
            '<ac:structured-macro ac:name="contentbylabel">'
            '<ac:parameter ac:name="labels">runbook,process</ac:parameter>'
            '<ac:parameter ac:name="max">20</ac:parameter>'
            '<ac:parameter ac:name="sort">modified</ac:parameter>'
            '<ac:parameter ac:name="reverse">true</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="by-label" labels="runbook,process" limit="20" '
            'reverse="true" scope="project" sort="modified"></query-block-component>'
        )
        assert result.is_lossless

    @pytest.mark.parametrize(
        "cql,expected",
        [
            ('label = "runbook"', "runbook"),
            ("label = runbook", "runbook"),
            ('label in ("runbook", "process")', "runbook,process"),
        ],
    )
    def test_contentbylabel_reads_labels_out_of_cql(self, cql, expected):
        body = (
            '<ac:structured-macro ac:name="contentbylabel">'
            f'<ac:parameter ac:name="cql">{cql}</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert f'labels="{expected}"' in result.html
        assert result.is_lossless

    def test_contentbylabel_with_extra_cql_clauses_is_downgraded(self):
        body = (
            '<ac:structured-macro ac:name="contentbylabel">'
            '<ac:parameter ac:name="cql">label = "runbook" and creator = "someone"</ac:parameter>'
            "</ac:structured-macro>"
        )

        result = convert(body)

        assert 'labels="runbook"' in result.html
        assert result.is_lossless
        assert result.downgraded == {"contentbylabel": 1}

    def test_contentbylabel_without_any_label_is_recorded(self):
        body = (
            '<ac:structured-macro ac:name="contentbylabel">'
            '<ac:parameter ac:name="cql">creator = "someone"</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert "query-block-component" not in result.html
        assert result.unsupported_macros == {"contentbylabel": 1}

    def test_listlabels_becomes_a_label_list(self):
        body = '<ac:structured-macro ac:name="listlabels"/>'

        result = convert(body)

        assert result.html == '<query-block-component kind="label-list" scope="project"></query-block-component>'
        assert result.is_lossless

    def test_listlabels_with_exclusions_is_downgraded(self):
        body = (
            '<ac:structured-macro ac:name="listlabels">'
            '<ac:parameter ac:name="excludedLabels">draft</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.is_lossless
        assert result.downgraded == {"listlabels": 1}

    def test_detailssummary_becomes_a_property_table(self):
        body = (
            '<ac:structured-macro ac:name="detailssummary">'
            '<ac:parameter ac:name="label">runbook</ac:parameter>'
            '<ac:parameter ac:name="headings">Owner, Status</ac:parameter>'
            '<ac:parameter ac:name="pageSize">25</ac:parameter>'
            '<ac:parameter ac:name="sortBy">title</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component columns="Owner,Status" kind="page-properties" '
            'labels="runbook" limit="25" scope="project" sort="title"></query-block-component>'
        )
        assert result.is_lossless

    def test_detailssummary_reads_its_labels_out_of_cql(self):
        body = (
            '<ac:structured-macro ac:name="detailssummary">'
            '<ac:parameter ac:name="cql">label in ("runbook", "process")</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert 'labels="runbook,process"' in result.html
        assert result.is_lossless

    def test_detailssummary_sorted_by_date_sorts_by_modification(self):
        body = (
            '<ac:structured-macro ac:name="detailssummary">'
            '<ac:parameter ac:name="sortBy">date</ac:parameter>'
            '<ac:parameter ac:name="reverseSort">true</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert 'sort="modified"' in result.html
        assert 'reverse="true"' in result.html

    def test_detailssummary_create_button_is_chrome_not_loss(self):
        body = (
            '<ac:structured-macro ac:name="detailssummary">'
            '<ac:parameter ac:name="createButtonLabel">New runbook</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.is_lossless
        assert result.dropped_chrome == {"detailssummary": 1}

    def test_content_report_table_becomes_a_property_table(self):
        body = (
            '<ac:structured-macro ac:name="content-report-table">'
            '<ac:parameter ac:name="labels">process</ac:parameter>'
            '<ac:parameter ac:name="maxResults">30</ac:parameter>'
            '<ac:parameter ac:name="sort">page created</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="page-properties" labels="process" '
            'limit="30" scope="project" sort="created"></query-block-component>'
        )
        assert result.is_lossless

    def test_content_report_table_across_spaces_widens_to_the_workspace(self):
        body = (
            '<ac:structured-macro ac:name="content-report-table">'
            '<ac:parameter ac:name="labels">process</ac:parameter>'
            '<ac:parameter ac:name="spaces">OTHER</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert 'scope="workspace"' in result.html
        assert result.is_lossless

    def test_tasks_report_becomes_a_task_report(self):
        body = (
            '<ac:structured-macro ac:name="tasks-report-macro">'
            '<ac:parameter ac:name="status">incomplete</ac:parameter>'
            '<ac:parameter ac:name="labels">runbook</ac:parameter>'
            '<ac:parameter ac:name="pageSize">40</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="task-report" labels="runbook" '
            'limit="40" scope="project" status="incomplete"></query-block-component>'
        )
        assert result.is_lossless

    def test_the_older_tasks_report_spelling_converts_too(self):
        result = convert('<ac:structured-macro ac:name="tasks-report"/>')

        assert result.html == '<query-block-component kind="task-report" scope="project"></query-block-component>'
        assert result.is_lossless

    def test_tasks_report_roots_itself_on_the_page_it_names(self):
        body = (
            '<ac:structured-macro ac:name="tasks-report-macro">'
            '<ac:parameter ac:name="pages">100</ac:parameter></ac:structured-macro>'
        )

        result = convert(body, _report_resolvers())

        assert 'root-page-id="p1"' in result.html
        assert 'scope="page"' in result.html
        assert result.is_lossless

    def test_tasks_report_naming_several_pages_keeps_the_first(self):
        body = (
            '<ac:structured-macro ac:name="tasks-report-macro">'
            '<ac:parameter ac:name="pages">100,200</ac:parameter></ac:structured-macro>'
        )

        result = convert(body, _report_resolvers())

        assert 'root-page-id="p1"' in result.html
        assert result.downgraded == {"tasks-report-macro": 1}
        assert result.is_lossless

    def test_tasks_report_missing_parameters_flag_is_chrome(self):
        """The flag records that the macro browser was never filled in, which
        is an authoring artifact rather than content."""
        body = (
            '<ac:structured-macro ac:name="tasks-report-macro">'
            '<ac:parameter ac:name="isMissingRequiredParameters">true</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert "query-block-component" in result.html
        assert result.is_lossless
        assert result.dropped_chrome == {"tasks-report-macro": 1}

    def test_decisionreport_becomes_a_decision_report(self):
        body = (
            '<ac:structured-macro ac:name="decisionreport">'
            '<ac:parameter ac:name="cql">label = "runbook"</ac:parameter>'
            '<ac:parameter ac:name="max">10</ac:parameter>'
            '<ac:parameter ac:name="sort">page created</ac:parameter></ac:structured-macro>'
        )

        result = convert(body)

        assert result.html == (
            '<query-block-component kind="decision-report" labels="runbook" '
            'limit="10" scope="project" sort="created"></query-block-component>'
        )
        assert result.is_lossless

    def test_decisionreport_across_spaces_widens_to_the_workspace(self):
        body = (
            '<ac:structured-macro ac:name="decisionreport">'
            '<ac:parameter ac:name="cql">space = "OTHER" and label = "runbook"</ac:parameter>'
            "</ac:structured-macro>"
        )

        result = convert(body)

        assert 'scope="workspace"' in result.html
        # The space clause is honoured by the scope, so it is not a downgrade.
        assert result.downgraded == {}
        assert result.is_lossless

    def test_decisionreport_with_an_unsupported_cql_clause_is_downgraded(self):
        body = (
            '<ac:structured-macro ac:name="decisionreport">'
            '<ac:parameter ac:name="cql">label = "runbook" and creator = "someone"</ac:parameter>'
            "</ac:structured-macro>"
        )

        result = convert(body)

        assert result.is_lossless
        assert result.downgraded == {"decisionreport": 1}

    def test_a_property_table_without_labels_still_converts(self):
        """Unlike contentbylabel, these list every page in scope when no label
        is named, so there is still something to show."""
        body = '<ac:structured-macro ac:name="content-report-table"/>'

        result = convert(body)

        assert result.html == '<query-block-component kind="page-properties" scope="project"></query-block-component>'
        assert result.is_lossless
