# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import copy
import re
from dataclasses import dataclass

from bs4 import NavigableString

from .colours import status_colour
from .inline import decode_emoji_fallback
from .links import link_text
from .macros import REFERENCE_MACROS
from .parameters import macro_parameter, macro_parameters

# Confluence writes task and decision dates as a bare ISO day.
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Macros whose whole content is one parameter. Everything else keeps its body.
_MACRO_TEXT = {"status": "title", "jira": "key", "requirement-yogi": "reqKey"}


@dataclass(frozen=True)
class IndexEntry:
    """One queryable fact on a page: a property row, a task or a decision."""

    kind: str
    key: str
    value: str
    is_complete: bool = False
    account_id: str = ""
    due_date: str = ""
    order: int = 0
    colour: str = ""


def _text(node):
    return node.get_text(" ", strip=True) if node is not None else ""


def _lozenge_colour(cell):
    """The palette colour of a value that is nothing but a status lozenge.

    A cell mixing a lozenge with other content has no one colour, so it keeps
    none: colouring the whole value would claim more than the page says.
    """
    macros = cell.find_all("ac:structured-macro")
    if len(macros) != 1 or (macros[0].get("ac:name") or "").lower() != "status":
        return ""
    if _text(cell) != _text(macros[0]):
        return ""
    parameters = macro_parameters(macros[0])
    return status_colour(parameters.get("colour")) if parameters.get("title") else ""


def _swap(node, text):
    """Replace a node with the text it will read as, link wrapper included."""
    target = node.find_parent("ac:link") or node
    label = link_text(target) if target is not node else ""
    target.replace_with(NavigableString(label or text))


def _flatten_macros(cell):
    """Innermost first, so a macro nested in a rich-text body is already text.

    A parameter configures a macro rather than being its content, so it is
    dropped unless it is the whole of what the macro shows.
    """
    for node in reversed(cell.find_all("ac:structured-macro")):
        name = (node.get("ac:name") or "").lower()
        if name in _MACRO_TEXT:
            node.replace_with(NavigableString(macro_parameters(node).get(_MACRO_TEXT[name], "")))
            continue
        # A reference macro is a link wearing macro chrome, and the link is in
        # a parameter, so unwrap it the way the conversion pass does.
        reference = macro_parameter(node, REFERENCE_MACROS[name]) if name in REFERENCE_MACROS else None
        if reference is not None:
            node.replace_with(*[child.extract() for child in list(reference.contents)])
            continue
        for configuration in node.find_all("ac:parameter", recursive=False):
            configuration.decompose()


def _value_text(cell, resolvers):
    """What a property value will read as once the page is converted.

    The index runs before the conversion passes, so the cell still holds
    Confluence markup: a mention carries its name in an attribute and a macro
    carries its content in parameters. Neither is text yet, so reading the cell
    directly indexes an empty value or the macro's configuration.
    """
    cell = copy.copy(cell)
    _flatten_macros(cell)

    for node in cell.find_all("ri:user"):
        user = resolvers.user(node.get("ri:account-id") or node.get("ri:userkey") or "")
        _swap(node, user.display_name if user is not None else "")
    for node in cell.find_all("ri:page"):
        page = resolvers.page(node.get("ri:content-title") or "", node.get("ri:space-key"))
        _swap(node, page.title if page is not None else node.get("ri:content-title") or "")
    for node in cell.find_all("ri:attachment"):
        _swap(node, node.get("ri:filename") or "")
    for node in cell.find_all("ri:space"):
        _swap(node, node.get("ri:space-key") or "")
    for node in cell.find_all("time"):
        node.replace_with(NavigableString(node.get("datetime") or ""))
    for node in cell.find_all("ac:emoticon"):
        node.replace_with(NavigableString(decode_emoji_fallback(node.get("ac:emoji-fallback"))))

    return _text(cell)


def _assignee(node):
    """The account the task is assigned to, which Confluence stores as an
    ordinary user mention inside the task body."""
    user = node.find("ri:user")
    return user.get("ri:account-id") or user.get("ri:userkey") or "" if user is not None else ""


def _due_date(node):
    for time_node in node.find_all("time"):
        value = (time_node.get("datetime") or "").strip()
        if _DATE.match(value):
            return value
    return ""


def _properties(soup, resolvers, result):
    """The key/value rows of every `details` macro on the page.

    Confluence's page properties macro reads the first column as the name and
    the second as the value. 736 of the 741 tables in the backup are exactly
    two columns wide; the rest keep their extra cells in the rendered table but
    cannot be indexed past the value.
    """
    entries = []
    for macro in soup.find_all("ac:structured-macro", attrs={"ac:name": "details"}):
        table = macro.find("table")
        if table is None:
            continue
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            key = _text(cells[0])
            if not key:
                continue
            if len(cells) > 2:
                result.downgraded["details"] += 1
            entries.append(
                IndexEntry(
                    kind="property",
                    key=key[:255],
                    value=_value_text(cells[1], resolvers),
                    colour=_lozenge_colour(cells[1]),
                    order=len(entries),
                )
            )
    return entries


def _tasks(soup):
    entries = []
    for task in soup.find_all("ac:task"):
        body = task.find("ac:task-body")
        value = _text(body)
        if not value:
            continue
        status = task.find("ac:task-status")
        entries.append(
            IndexEntry(
                kind="task",
                key="",
                value=value,
                is_complete=status is not None and status.get_text().strip() == "complete",
                account_id=_assignee(body) if body is not None else "",
                due_date=_due_date(body) if body is not None else "",
                order=len(entries),
            )
        )
    return entries


def _decisions(soup):
    entries = []
    for item in soup.find_all("ac:adf-node", attrs={"type": "decision-item"}):
        value = _text(item.find("ac:adf-content", recursive=False))
        if not value:
            continue
        # A recorded decision is a decision that was taken, the same reading
        # the decision list conversion applies.
        entries.append(IndexEntry(kind="decision", key="", value=value, is_complete=True, order=len(entries)))
    return entries


def index_page(soup, resolvers, result):
    """Everything on the page that a query block can aggregate.

    Runs before any conversion pass, because the passes rewrite exactly the
    elements this reads: `details` macros are unwrapped to their table, tasks
    become checkbox items and decisions become a ticked list.
    """
    result.index_entries.extend(_properties(soup, resolvers, result) + _tasks(soup) + _decisions(soup))
