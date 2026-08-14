# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import html
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone

from ..confluence.colours import CALLOUT_MACROS, background_variable, palette_colour, status_colour
from ..confluence.resolvers import Resolvers

# Marks the editor has a tag for, one to one.
SIMPLE_MARKS = {"strong": "strong", "em": "em", "strike": "s", "underline": "u", "code": "code"}

# Marks with no editor equivalent whose text survives without them.
INERT_MARKS = ("subsup", "border", "indentation")

# Table layouts that change nothing about the cells. The rest widen the table.
KEPT_TABLE_LAYOUTS = ("default", "center")

MAX_HEADING_LEVEL = 6


@dataclass
class Tally:
    """Where each construct landed. `chrome` never held content, `lost` did."""

    converted: Counter = field(default_factory=Counter)
    downgraded: Counter = field(default_factory=Counter)
    chrome: Counter = field(default_factory=Counter)
    lost: Counter = field(default_factory=Counter)

    @property
    def buckets(self):
        return (self.converted, self.downgraded, self.chrome, self.lost)

    @property
    def total(self):
        return sum(sum(bucket.values()) for bucket in self.buckets)

    def update(self, other):
        for own, theirs in zip(self.buckets, other.buckets):
            own.update(theirs)


@dataclass
class AdfResult:
    """What converting one document cost."""

    html: str = ""
    nodes: Tally = field(default_factory=Tally)
    marks: Tally = field(default_factory=Tally)
    unresolved_users: set = field(default_factory=set)
    unresolved_attachments: set = field(default_factory=set)
    # Media placed by the single-attachment rule rather than by name.
    inferred_media: int = 0

    @property
    def loss(self):
        return sum(self.nodes.lost.values()) + sum(self.marks.lost.values())

    @property
    def is_lossless(self):
        return not (self.loss or self.unresolved_users or self.unresolved_attachments)


def _escape(value):
    return html.escape(str(value), quote=False) if value else ""


def _attribute(value):
    return html.escape(str(value), quote=True) if value else ""


def _integer(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _iso_date(timestamp):
    """An ADF date is milliseconds since the epoch, as a string."""
    milliseconds = _integer(timestamp)
    if milliseconds is None:
        return ""
    return datetime.fromtimestamp(milliseconds / 1000, tz=timezone.utc).date().isoformat()


def _pixels(value):
    size = _integer(value)
    return f"{size}px" if size and size > 0 else None


def _tag(name, attributes=None, inner=""):
    rendered = "".join(f' {key}="{_attribute(value)}"' for key, value in (attributes or {}).items() if value)
    return f"<{name}{rendered}>{inner}</{name}>"


class _Converter:
    def __init__(self, resolvers, result, fallback_attachment=None):
        self.resolvers = resolvers
        self.result = result
        self.fallback_attachment = fallback_attachment
        self.handlers = {
            "doc": self._doc,
            "paragraph": self._paragraph,
            "heading": self._heading,
            "text": self._text,
            "hardBreak": self._hard_break,
            "rule": self._rule,
            "bulletList": self._bullet_list,
            "orderedList": self._ordered_list,
            "listItem": self._list_item,
            "blockquote": self._blockquote,
            "codeBlock": self._code_block,
            "table": self._table,
            "tableRow": self._table_row,
            "tableCell": self._table_cell,
            "tableHeader": self._table_header,
            "taskList": self._task_list,
            "taskItem": self._task_item,
            "panel": self._panel,
            "expand": self._expand,
            "status": self._status,
            "date": self._date,
            "emoji": self._emoji,
            "mention": self._mention,
            "media": self._media,
            "mediaInline": self._media,
            "mediaSingle": self._media_container,
            "mediaGroup": self._media_container,
            "inlineCard": self._inline_card,
            "blockCard": self._block_card,
            "embedCard": self._block_card,
        }

    def document(self, document):
        document = document or {}
        return self.node(document) if document.get("type") else self.children(document)

    def node(self, node):
        if not isinstance(node, dict):
            return ""
        name = node.get("type") or ""
        handler = self.handlers.get(name)
        if handler is None:
            self.result.nodes.lost[name or "unknown"] += 1
            rendered = self.children(node)
        else:
            rendered = handler(node)

        for mark in node.get("marks") or []:
            rendered = self._mark(mark, rendered)
        return rendered

    def children(self, node):
        return "".join(self.node(child) for child in (node.get("content") or []))

    def _converted(self, node, inner=""):
        self.result.nodes.converted[node["type"]] += 1
        return inner

    def _doc(self, node):
        return self._converted(node, self.children(node))

    def _paragraph(self, node):
        return self._converted(node, f"<p>{self.children(node)}</p>")

    def _heading(self, node):
        level = min(max(_integer((node.get("attrs") or {}).get("level")) or 1, 1), MAX_HEADING_LEVEL)
        return self._converted(node, f"<h{level}>{self.children(node)}</h{level}>")

    def _text(self, node):
        return self._converted(node, _escape(node.get("text")))

    def _hard_break(self, node):
        return self._converted(node, "<br />")

    def _rule(self, node):
        return self._converted(node, "<hr />")

    def _bullet_list(self, node):
        return self._converted(node, f"<ul>{self.children(node)}</ul>")

    def _ordered_list(self, node):
        order = _integer((node.get("attrs") or {}).get("order"))
        start = f' start="{order}"' if order and order != 1 else ""
        return self._converted(node, f"<ol{start}>{self.children(node)}</ol>")

    def _list_item(self, node):
        return self._converted(node, f"<li>{self.children(node)}</li>")

    def _blockquote(self, node):
        return self._converted(node, f"<blockquote>{self.children(node)}</blockquote>")

    def _code_block(self, node):
        language = ((node.get("attrs") or {}).get("language") or "").strip()
        text = ""
        for child in node.get("content") or []:
            self.result.nodes.converted[child.get("type") or "unknown"] += 1
            text += child.get("text") or ""
        attribute = f' language="{_attribute(language)}"' if language else ""
        return self._converted(node, f"<pre{attribute}><code{attribute}>{_escape(text)}</code></pre>")

    def _table(self, node):
        inner = f"<table><tbody>{self.children(node)}</tbody></table>"
        if ((node.get("attrs") or {}).get("layout") or "default") in KEPT_TABLE_LAYOUTS:
            return self._converted(node, inner)
        # Every cell survives, so narrowing a full-width table is not loss.
        self.result.nodes.downgraded["table"] += 1
        return inner

    def _table_row(self, node):
        return self._converted(node, f"<tr>{self.children(node)}</tr>")

    def _table_cell(self, node, tag="td"):
        attrs = node.get("attrs") or {}
        colwidth = ",".join(str(width) for width in (attrs.get("colwidth") or []) if _integer(width))
        colour = palette_colour(attrs.get("background"))
        attributes = {
            "colspan": attrs.get("colspan") if _integer(attrs.get("colspan")) not in (None, 1) else None,
            "rowspan": attrs.get("rowspan") if _integer(attrs.get("rowspan")) not in (None, 1) else None,
            "colwidth": colwidth,
            "background": background_variable(colour) if colour else None,
        }
        inner = _tag(tag, attributes, self.children(node))
        if colour is None:
            return self._converted(node, inner)
        # Jira writes an exact shade; the editor only has its own palette.
        self.result.nodes.downgraded[node["type"]] += 1
        return inner

    def _table_header(self, node):
        return self._table_cell(node, tag="th")

    def _task_list(self, node):
        return self._converted(node, f'<ul data-type="taskList">{self.children(node)}</ul>')

    def _task_item(self, node):
        checked = ((node.get("attrs") or {}).get("state") or "").upper() == "DONE"
        checkbox = '<input type="checkbox" checked="checked" />' if checked else '<input type="checkbox" />'
        return self._converted(
            node,
            f'<li data-type="taskItem" data-checked="{"true" if checked else "false"}">'
            f"<label>{checkbox}<span></span></label>"
            f"<div><p>{self.children(node)}</p></div></li>",
        )

    def _panel(self, node):
        panel_type = ((node.get("attrs") or {}).get("panelType") or "info").lower()
        icon_name, icon_colour = CALLOUT_MACROS.get(panel_type, CALLOUT_MACROS["panel"])
        attributes = {
            "data-block-type": "callout-component",
            "data-logo-in-use": "icon",
            "data-icon-name": icon_name,
            "data-icon-color": icon_colour,
        }
        return self._converted(node, _tag("div", attributes, self.children(node)))

    def _expand(self, node):
        """The editor has no collapsible block, so the body is always open and
        the title becomes a line above it."""
        self.result.nodes.downgraded["expand"] += 1
        title = _escape((node.get("attrs") or {}).get("title"))
        return (f"<p><strong>{title}</strong></p>" if title else "") + self.children(node)

    def _status(self, node):
        """A lozenge is a word plus a colour, and the colour is what makes a
        column of them readable at a glance."""
        attrs = node.get("attrs") or {}
        text = _escape(attrs.get("text"))
        inner = _tag("span", {"data-background-color": status_colour(attrs.get("color"))}, text) if text else ""
        return self._converted(node, inner)

    def _date(self, node):
        return self._converted(node, _iso_date((node.get("attrs") or {}).get("timestamp")))

    def _emoji(self, node):
        """A bare character always renders, and the editor's emoji node is keyed
        by GitHub shortcode, which not every Atlassian shortname has."""
        attrs = node.get("attrs") or {}
        return self._converted(node, _escape(attrs.get("text") or attrs.get("shortName")))

    def _mention(self, node):
        attrs = node.get("attrs") or {}
        account_id = attrs.get("id") or ""
        user = self.resolvers.user(account_id)
        if user is None:
            self.result.nodes.downgraded["mention"] += 1
            self.result.unresolved_users.add(account_id)
            return _escape(attrs.get("text") or "@unknown")
        attributes = {"id": user.id, "entity_identifier": user.id, "entity_name": "user_mention"}
        return self._converted(node, _tag("mention-component", attributes))

    def _media(self, node):
        attrs = node.get("attrs") or {}
        if attrs.get("url"):
            return self._converted(node, f'<img src="{_attribute(attrs.get("url"))}" />')

        # `alt` is the only attribute tying a media node to a backed-up file.
        # The media id is an Atlassian media-services uuid and the export kept
        # nothing that maps it back to an attachment.
        filename = attrs.get("alt") or ""
        attachment = self.resolvers.attachment(filename) if filename else None
        if attachment is None and not filename and self.fallback_attachment is not None:
            attachment = self.fallback_attachment
            self.result.inferred_media += 1

        if attachment is None:
            self.result.nodes.lost[node["type"]] += 1
            if filename:
                self.result.unresolved_attachments.add(filename)
            return _escape(f"[{filename}]" if filename else "")

        if not attachment.is_image:
            return self._converted(node, _tag("a", {"href": attachment.url}, _escape(attachment.filename)))
        attributes = {
            "id": attachment.id,
            "src": attachment.id,
            "width": _pixels(attrs.get("width")),
            "height": _pixels(attrs.get("height")),
        }
        return self._converted(node, _tag("image-component", attributes))

    def _media_container(self, node):
        """A layout wrapper; the media inside is what carries the content."""
        self.result.nodes.chrome[node["type"]] += 1
        return self.children(node)

    def _inline_card(self, node):
        return self._card(node, block=False)

    def _block_card(self, node):
        return self._card(node, block=True)

    def _card(self, node, block):
        """A smart card renders a live preview of its target, which the editor
        has no node for, so only the address survives."""
        self.result.nodes.downgraded[node["type"]] += 1
        attrs = node.get("attrs") or {}
        url = attrs.get("url") or (attrs.get("data") or {}).get("url") or ""
        if not url:
            return ""
        link = _tag("a", {"href": url}, _escape(url))
        return f"<p>{link}</p>" if block else link

    def _mark(self, mark, inner):
        name = mark.get("type") or ""
        attrs = mark.get("attrs") or {}

        tag = SIMPLE_MARKS.get(name)
        if tag:
            self.result.marks.converted[name] += 1
            return f"<{tag}>{inner}</{tag}>"

        if name == "link":
            self.result.marks.converted[name] += 1
            return _tag("a", {"href": attrs.get("href")}, inner)

        if name == "textColor":
            self.result.marks.downgraded[name] += 1
            colour = palette_colour(attrs.get("color"))
            return _tag("span", {"data-text-color": colour}, inner) if colour else inner

        if name in INERT_MARKS:
            self.result.marks.downgraded[name] += 1
            return inner

        self.result.marks.lost[name or "unknown"] += 1
        return inner


def adf_to_html(document, resolvers=None, result=None, fallback_attachment=None):
    """Convert an Atlassian Document Format v1 document to editor HTML.

    ADF is the only description and comment format the backup holds. Pass
    ``result`` to accumulate the tallies across the several documents an issue
    carries; ``html`` then holds the last document converted.

    ``fallback_attachment`` is the file to place for a media node that names no
    file. Only the caller can tell whether that guess is safe, so it decides.
    """
    result = result or AdfResult()
    converter = _Converter(resolvers or Resolvers(), result, fallback_attachment)
    result.html = converter.document(document).strip() or "<p></p>"
    return result
