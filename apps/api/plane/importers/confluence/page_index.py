# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
from dataclasses import dataclass

# Confluence writes task and decision dates as a bare ISO day.
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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


def _text(node):
    return node.get_text(" ", strip=True) if node is not None else ""


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


def _properties(soup, result):
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
            entries.append(IndexEntry(kind="property", key=key[:255], value=_text(cells[1]), order=len(entries)))
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


def index_page(soup, result):
    """Everything on the page that a query block can aggregate.

    Runs before any conversion pass, because the passes rewrite exactly the
    elements this reads: `details` macros are unwrapped to their table, tasks
    become checkbox items and decisions become a ticked list.
    """
    result.index_entries.extend(_properties(soup, result) + _tasks(soup) + _decisions(soup))
