# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.confluence.resolvers import ResolvedAttachment, ResolvedUser, Resolvers
from plane.importers.jira.adf import adf_to_html

USER_ID = "11111111-1111-4111-8111-111111111111"
IMAGE_ID = "22222222-2222-4222-8222-222222222222"
FILE_ID = "33333333-3333-4333-8333-333333333333"

RESOLVERS = Resolvers(
    users={"account-1": ResolvedUser(id=USER_ID, display_name="Ada Sample")},
    attachments={
        "diagram.png": ResolvedAttachment(id=IMAGE_ID, filename="diagram.png", is_image=True),
        "spec.pdf": ResolvedAttachment(id=FILE_ID, filename="spec.pdf", is_image=False, url="/assets/spec.pdf"),
    },
)


def doc(*content):
    return {"type": "doc", "version": 1, "content": list(content)}


def text(value, *marks):
    node = {"type": "text", "text": value}
    if marks:
        node["marks"] = list(marks)
    return node


def paragraph(*content):
    return {"type": "paragraph", "content": list(content)}


def node(name, attrs=None, content=None, marks=None):
    built = {"type": name}
    if attrs is not None:
        built["attrs"] = attrs
    if content is not None:
        built["content"] = content
    if marks is not None:
        built["marks"] = marks
    return built


def image_media(marks=None, **attrs):
    return node("media", {"type": "file", "id": "media-1", "alt": "diagram.png", **attrs}, marks=marks)


def count_nodes(document):
    return 1 + sum(count_nodes(child) for child in document.get("content") or [])


def count_marks(document):
    return len(document.get("marks") or []) + sum(count_marks(child) for child in document.get("content") or [])


# One document per node type in the backup's measured inventory.
NODES = {
    "doc": (doc(paragraph(text("Ship the release notes."))), "<p>Ship the release notes.</p>"),
    "paragraph": (doc(paragraph(text("Plain prose."))), "<p>Plain prose.</p>"),
    "text": (doc(paragraph(text("Escaped <tags> & ampersands."))), "<p>Escaped &lt;tags&gt; &amp; ampersands.</p>"),
    "heading": (doc(node("heading", {"level": 2}, [text("Rollout plan")])), "<h2>Rollout plan</h2>"),
    "hardBreak": (doc(paragraph(text("first"), node("hardBreak"), text("second"))), "<p>first<br />second</p>"),
    "rule": (doc(node("rule")), "<hr />"),
    "bulletList": (
        doc(node("bulletList", content=[node("listItem", content=[paragraph(text("Check the queue"))])])),
        "<ul><li><p>Check the queue</p></li></ul>",
    ),
    "orderedList": (
        doc(node("orderedList", {"order": 3}, [node("listItem", content=[paragraph(text("Third step"))])])),
        '<ol start="3"><li><p>Third step</p></li></ol>',
    ),
    "listItem": (
        doc(node("bulletList", content=[node("listItem", content=[paragraph(text("Only item"))])])),
        "<ul><li><p>Only item</p></li></ul>",
    ),
    "blockquote": (
        doc(node("blockquote", content=[paragraph(text("Quoted line"))])),
        "<blockquote><p>Quoted line</p></blockquote>",
    ),
    "codeBlock": (
        doc(node("codeBlock", {"language": "python"}, [text("value = 1")])),
        '<pre language="python"><code language="python">value = 1</code></pre>',
    ),
    "table": (
        doc(
            node(
                "table",
                {"layout": "default"},
                [
                    node("tableRow", content=[node("tableHeader", {"colwidth": [120]}, [paragraph(text("Owner"))])]),
                    node("tableRow", content=[node("tableCell", {}, [paragraph(text("Platform"))])]),
                ],
            )
        ),
        '<table><tbody><tr><th colwidth="120"><p>Owner</p></th></tr><tr><td><p>Platform</p></td></tr></tbody></table>',
    ),
    "tableRow": (
        doc(node("table", content=[node("tableRow", content=[node("tableCell", {}, [paragraph(text("One"))])])])),
        "<table><tbody><tr><td><p>One</p></td></tr></tbody></table>",
    ),
    "tableCell": (
        doc(
            node(
                "table",
                content=[node("tableRow", content=[node("tableCell", {"colspan": 2}, [paragraph(text("Wide"))])])],
            )
        ),
        '<table><tbody><tr><td colspan="2"><p>Wide</p></td></tr></tbody></table>',
    ),
    "tableHeader": (
        doc(node("table", content=[node("tableRow", content=[node("tableHeader", {}, [paragraph(text("Head"))])])])),
        "<table><tbody><tr><th><p>Head</p></th></tr></tbody></table>",
    ),
    "taskList": (
        doc(node("taskList", content=[node("taskItem", {"state": "TODO"}, [text("Open task")])])),
        '<ul data-type="taskList">'
        '<li data-type="taskItem" data-checked="false">'
        '<label><input type="checkbox" /><span></span></label>'
        "<div><p>Open task</p></div></li></ul>",
    ),
    "taskItem": (
        doc(node("taskList", content=[node("taskItem", {"state": "DONE"}, [text("Sign off")])])),
        '<ul data-type="taskList">'
        '<li data-type="taskItem" data-checked="true">'
        '<label><input type="checkbox" checked="checked" /><span></span></label>'
        "<div><p>Sign off</p></div></li></ul>",
    ),
    "panel": (
        doc(node("panel", {"panelType": "warning"}, [paragraph(text("Mind the gap"))])),
        '<div data-block-type="callout-component" data-logo-in-use="icon" '
        'data-icon-name="TriangleAlert" data-icon-color="#e0a800"><p>Mind the gap</p></div>',
    ),
    "expand": (
        doc(node("expand", {"title": "Details"}, [paragraph(text("Folded away"))])),
        "<p><strong>Details</strong></p><p>Folded away</p>",
    ),
    "status": (
        doc(paragraph(node("status", {"text": "approved", "color": "green"}))),
        '<p><span data-background-color="green">approved</span></p>',
    ),
    "date": (doc(paragraph(node("date", {"timestamp": "1707436800000"}))), "<p>2024-02-09</p>"),
    "emoji": (
        doc(paragraph(node("emoji", {"shortName": ":white_check_mark:", "text": "\N{WHITE HEAVY CHECK MARK}"}))),
        "<p>\N{WHITE HEAVY CHECK MARK}</p>",
    ),
    "mention": (
        doc(paragraph(node("mention", {"id": "account-1", "text": "@Ada Sample"}))),
        f'<p><mention-component id="{USER_ID}" entity_identifier="{USER_ID}" '
        'entity_name="user_mention"></mention-component></p>',
    ),
    "media": (
        doc(node("mediaSingle", {"layout": "center"}, [image_media(width=400, height=200)])),
        f'<image-component id="{IMAGE_ID}" src="{IMAGE_ID}" width="400px" height="200px"></image-component>',
    ),
    "mediaSingle": (
        doc(node("mediaSingle", {"layout": "wide"}, [image_media()])),
        f'<image-component id="{IMAGE_ID}" src="{IMAGE_ID}"></image-component>',
    ),
    "mediaGroup": (
        doc(node("mediaGroup", content=[node("media", {"type": "file", "id": "media-2", "alt": "spec.pdf"})])),
        '<a href="/assets/spec.pdf">spec.pdf</a>',
    ),
    "mediaInline": (
        doc(paragraph(node("mediaInline", {"type": "file", "id": "media-3", "alt": "spec.pdf"}))),
        '<p><a href="/assets/spec.pdf">spec.pdf</a></p>',
    ),
    "inlineCard": (
        doc(paragraph(node("inlineCard", {"url": "https://example.com/board"}))),
        '<p><a href="https://example.com/board">https://example.com/board</a></p>',
    ),
    "blockCard": (
        doc(node("blockCard", {"url": "https://example.com/plan"})),
        '<p><a href="https://example.com/plan">https://example.com/plan</a></p>',
    ),
    "embedCard": (
        doc(node("embedCard", {"url": "https://example.com/embed"})),
        '<p><a href="https://example.com/embed">https://example.com/embed</a></p>',
    ),
}

# One document per mark in the backup's measured inventory.
MARKS = {
    "strong": (doc(paragraph(text("bold", node("strong")))), "<p><strong>bold</strong></p>"),
    "em": (doc(paragraph(text("italic", node("em")))), "<p><em>italic</em></p>"),
    "strike": (doc(paragraph(text("gone", node("strike")))), "<p><s>gone</s></p>"),
    "underline": (doc(paragraph(text("lined", node("underline")))), "<p><u>lined</u></p>"),
    "code": (doc(paragraph(text("inline_code", node("code")))), "<p><code>inline_code</code></p>"),
    "link": (
        doc(paragraph(text("the spec", node("link", {"href": "https://example.com/spec"})))),
        '<p><a href="https://example.com/spec">the spec</a></p>',
    ),
    "textColor": (
        doc(paragraph(text("green words", node("textColor", {"color": "#36b37e"})))),
        '<p><span data-text-color="green">green words</span></p>',
    ),
    "subsup": (doc(paragraph(text("2", node("subsup", {"type": "sup"})))), "<p>2</p>"),
    "border": (
        doc(node("mediaSingle", content=[image_media(marks=[node("border", {"size": 2, "color": "#091e42"})])])),
        f'<image-component id="{IMAGE_ID}" src="{IMAGE_ID}"></image-component>',
    ),
    "indentation": (
        doc(paragraph(text("pushed right", node("indentation", {"level": 1})))),
        "<p>pushed right</p>",
    ),
}


def convert(document):
    return adf_to_html(document, RESOLVERS)


@pytest.mark.unit
class TestNodes:
    """The backup holds thirty node types and nothing else, so each one has a
    mapping here and none of them may fall through silently."""

    @pytest.mark.parametrize("name", sorted(NODES))
    def test_node_converts(self, name):
        document, expected = NODES[name]

        assert convert(document).html == expected

    @pytest.mark.parametrize("name", sorted(NODES))
    def test_every_node_lands_in_exactly_one_bucket(self, name):
        document, _ = NODES[name]

        result = convert(document)

        assert result.nodes.total == count_nodes(document)

    @pytest.mark.parametrize("name", sorted(NODES))
    def test_the_inventory_holds_no_losses(self, name):
        document, _ = NODES[name]

        assert convert(document).nodes.lost == {}


@pytest.mark.unit
class TestMarks:
    @pytest.mark.parametrize("name", sorted(MARKS))
    def test_mark_converts(self, name):
        document, expected = MARKS[name]

        assert convert(document).html == expected

    @pytest.mark.parametrize("name", sorted(MARKS))
    def test_every_mark_lands_in_exactly_one_bucket(self, name):
        document, _ = MARKS[name]

        result = convert(document)

        assert result.marks.total == count_marks(document)
        assert result.marks.lost == {}


@pytest.mark.unit
class TestAccounting:
    def test_the_buckets_add_up_to_the_node_count(self):
        document = doc(*(NODES[name][0]["content"][0] for name in sorted(NODES)))

        result = convert(document)

        assert result.nodes.total == count_nodes(document)
        assert result.marks.total == count_marks(document)

    def test_cards_and_expands_are_downgrades(self):
        document = doc(
            node("expand", {"title": "More"}, [paragraph(text("body"))]),
            node("blockCard", {"url": "https://example.com/plan"}),
        )

        result = convert(document)

        assert result.nodes.downgraded == {"expand": 1, "blockCard": 1}

    def test_media_wrappers_are_chrome(self):
        document = doc(node("mediaSingle", content=[image_media()]))

        assert convert(document).nodes.chrome == {"mediaSingle": 1}

    def test_a_node_outside_the_inventory_is_reported_not_dropped(self):
        document = doc(node("decisionList", content=[paragraph(text("kept text"))]))

        result = convert(document)

        assert result.nodes.lost == {"decisionList": 1}
        assert result.html == "<p>kept text</p>"
        assert not result.is_lossless

    def test_a_mark_outside_the_inventory_is_reported_not_dropped(self):
        document = doc(paragraph(text("annotated", node("annotation", {"id": "1"}))))

        result = convert(document)

        assert result.marks.lost == {"annotation": 1}
        assert result.html == "<p>annotated</p>"


@pytest.mark.unit
class TestResolution:
    def test_an_unknown_mention_keeps_the_typed_name(self):
        document = doc(paragraph(node("mention", {"id": "account-9", "text": "@Someone Else"})))

        result = convert(document)

        assert result.html == "<p>@Someone Else</p>"
        assert result.unresolved_users == {"account-9"}
        assert result.nodes.downgraded == {"mention": 1}

    def test_a_missing_attachment_is_named_and_counted(self):
        document = doc(node("mediaSingle", content=[node("media", {"type": "file", "alt": "missing.png"})]))

        result = convert(document)

        assert result.html == "[missing.png]"
        assert result.unresolved_attachments == {"missing.png"}
        assert result.nodes.lost == {"media": 1}

    def test_external_media_keeps_its_address(self):
        document = doc(
            node("mediaSingle", content=[node("media", {"type": "external", "url": "https://x.test/a.png"})])
        )

        assert convert(document).html == '<img src="https://x.test/a.png" />'


@pytest.mark.unit
class TestDocument:
    def test_an_empty_document_is_still_a_paragraph(self):
        assert adf_to_html({"type": "doc", "version": 1, "content": []}).html == "<p></p>"

    @pytest.mark.parametrize("document", [None, {}])
    def test_a_missing_document_converts(self, document):
        assert adf_to_html(document).html == "<p></p>"

    def test_a_wide_table_is_a_downgrade(self):
        document = doc(node("table", {"layout": "full-width"}, [node("tableRow", content=[])]))

        assert convert(document).nodes.downgraded == {"table": 1}

    def test_a_highlighted_cell_lands_on_the_editor_palette(self):
        cell = node("tableCell", {"background": "#deebff"}, [paragraph(text("Blue"))])
        document = doc(node("table", content=[node("tableRow", content=[cell])]))

        result = convert(document)

        assert 'background="var(--editor-colors-dark-blue-background)"' in result.html
        assert result.nodes.downgraded == {"tableCell": 1}
