# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import datetime
from urllib.parse import unquote

from .parameters import macro_parameters

_DURATION_UNITS = {"MONTH": "month", "WEEK": "week"}


def _decode_source(raw):
    if not raw:
        return None
    try:
        document = json.loads(unquote(raw))
    except ValueError:
        return None
    return document if isinstance(document, dict) else None


def _format_date(value):
    if not isinstance(value, str) or not value:
        return ""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return value


def _format_duration(duration, display_option):
    if isinstance(duration, bool) or not isinstance(duration, (int, float)):
        return ""
    unit = _DURATION_UNITS.get(display_option, (display_option or "").lower())
    number = f"{round(duration, 2):.2f}".rstrip("0").rstrip(".")
    if not unit:
        return number
    return f"{number} {unit}{'' if number == '1' else 's'}"


def _bar_sort_key(bar):
    row_index = bar.get("rowIndex")
    return (row_index if isinstance(row_index, (int, float)) else float("inf"), bar.get("startDate") or "")


def _cell(soup, tag_name, text=""):
    cell = soup.new_tag(tag_name)
    paragraph = soup.new_tag("p")
    if text:
        paragraph.string = text
    cell.append(paragraph)
    return cell


def _row(soup, tag_name, values):
    tr = soup.new_tag("tr")
    for value in values:
        tr.append(_cell(soup, tag_name, value))
    return tr


def _table(soup, header, rows):
    table = soup.new_tag("table")
    tbody = soup.new_tag("tbody")
    tbody.append(_row(soup, "th", header))
    for row in rows:
        tbody.append(_row(soup, "td", row))
    table.append(tbody)
    return table


def _bar_row(lane_title, bar, display_option):
    return [
        lane_title,
        bar.get("title") or "",
        _format_date(bar.get("startDate")),
        _format_duration(bar.get("duration"), display_option),
        bar.get("description") or "",
    ]


def _bars_rows(lanes, display_option):
    rows = []
    for lane in lanes:
        lane_title = lane.get("title") or ""
        bars = lane.get("bars") or []
        if not bars:
            rows.append([lane_title, "", "", "", ""])
            continue
        for bar in sorted(bars, key=_bar_sort_key):
            rows.append(_bar_row(lane_title, bar, display_option))
    return rows


def convert_roadmap_macro(soup, node, result):
    """The Roadmap Planner's whole state is a JSON snapshot in its source
    parameter, so a table carries all of it; only the timeline drawing is
    lost, which makes this a downgrade rather than a loss."""
    parameters = macro_parameters(node)
    document = _decode_source(parameters.get("source", ""))

    if document is None:
        result.unsupported_macros["roadmap"] += 1
        node.decompose()
        return

    lanes = document.get("lanes") or []
    markers = document.get("markers") or []
    if not lanes and not markers:
        node.decompose()
        return

    title = parameters.get("title", "").strip() or (document.get("title") or "").strip()
    display_option = (document.get("timeline") or {}).get("displayOption")

    fragments = []
    if title:
        title_paragraph = soup.new_tag("p")
        strong = soup.new_tag("strong")
        strong.string = title
        title_paragraph.append(strong)
        fragments.append(title_paragraph)
    if lanes:
        header = ["Lane", "Item", "Start", "Duration", "Description"]
        fragments.append(_table(soup, header, _bars_rows(lanes, display_option)))
    if markers:
        rows = [[marker.get("title") or "", _format_date(marker.get("markerDate"))] for marker in markers]
        fragments.append(_table(soup, ["Milestone", "Date"], rows))

    result.downgraded["roadmap"] += 1
    node.replace_with(*fragments)
