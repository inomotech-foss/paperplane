# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Read the "Document status" table Confluence pages kept by hand.

Many controlled documents in Confluence open with a small key/value table:

    Document status
    | Owner          | Security officer |                         |
    | Classification | Internal         |                         |
    | Status         | approved         | draft  REVIEW  approved |
    | Approved on    | 03.11.2025       |                         |
    | Approved by    | Roger Knecht     |                         |

The third column, where there is one, is a legend of the possible values and
is ignored. This module finds such a table and returns what it says, as
written. It is information about the page's past, not an approval: the name
is never matched to a user, and an unreadable date is kept as text.

The parser is defensive. Pages are hand-made, so it reads any table whose
rows are labelled cells, accepts header or data cells as labels, and returns
None rather than raising on anything it does not understand.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime

from bs4 import BeautifulSoup, Tag

STATUS_LABELS = {"status", "document status", "dokumentstatus", "doc status"}
APPROVED_BY_LABELS = {
    "approved by",
    "approver",
    "approval by",
    "genehmigt von",
    "genehmigt durch",
    "freigegeben von",
    "freigegeben durch",
    "freigabe durch",
}
APPROVED_ON_LABELS = {
    "approved on",
    "approved at",
    "approval date",
    "date approved",
    "approved date",
    "genehmigt am",
    "freigegeben am",
    "freigabedatum",
    "freigabe am",
}
# A table preceded by such a heading is a status table even without approval rows.
HEADING = re.compile(r"document\s*status|dokument\s*status|document\s*control", re.IGNORECASE)
HEADINGS = ("h1", "h2", "h3", "h4", "h5", "h6")

# Statuses that record an approval
APPROVED_STATUSES = {"approved", "genehmigt", "freigegeben", "released"}

# What an empty cell is often filled with
PLACEHOLDERS = {"-", "–", "—", "n/a", "na", "tbd", "?"}

# A cell naming the approver by a user mention has no text. The mention is not
# resolved: a legacy approver is never matched to a user here.
MENTIONED_USER = "(user mention, not resolved)"

MAX_STATUS = 50
MAX_NAME = 255
MAX_RAW_DATE = 50

DATE_PATTERNS = (
    # 03.11.2025, 3.11.25, 03/11/2025 (day first, as written in Switzerland and Germany)
    (re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b"), "dmy"),
    # 2025-11-03
    (re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"), "ymd"),
)
TEXT_DATE_FORMATS = ("%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y")


@dataclass(frozen=True)
class LegacyApproval:
    """The document status a page recorded before it came here, as written."""

    status: str = ""
    approved_by: str = ""
    approved_at: date | None = None
    # the date cell as written, kept whether or not it could be read
    approved_at_raw: str = ""

    @property
    def is_approved(self):
        return self.status.strip().lower() in APPROVED_STATUSES

    @property
    def is_empty(self):
        return not (self.status or self.approved_by or self.approved_at or self.approved_at_raw)


def _text(cell):
    text = cell.get_text(" ", strip=True).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return "" if text.lower() in PLACEHOLDERS else text


def _label(cell):
    return _text(cell).rstrip(":").strip().lower()


def parse_date(text):
    """A date written in a cell, or None. Day first, as the pages are Swiss."""
    if not text:
        return None
    for pattern, order in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        a, b, c = (int(part) for part in match.groups())
        if order == "dmy":
            day, month, year = a, b, c
            if year < 100:
                year += 2000
        else:
            year, month, day = a, b, c
        try:
            return date(year, month, day)
        except ValueError:
            continue
    cleaned = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", text.strip())
    for fmt in TEXT_DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def _approver(cell):
    name = _text(cell)
    if not name and cell.find("mention-component", attrs={"entity_name": "user_mention"}) is not None:
        return MENTIONED_USER
    return name[:MAX_NAME]


def _date_from_cell(cell):
    # Confluence's date macro exports as <time datetime="2025-11-03">
    time = cell.find("time")
    if isinstance(time, Tag) and time.get("datetime"):
        try:
            return date.fromisoformat(str(time["datetime"])[:10])
        except ValueError:
            pass
    return parse_date(_text(cell))


def _rows(table):
    """(label, value cell) for each row whose first cell labels the second."""
    for row in table.find_all("tr"):
        # rows of a nested table belong to that table
        if row.find_parent("table") is not table:
            continue
        cells = [cell for cell in row.find_all(["th", "td"], recursive=False)]
        if len(cells) < 2:
            continue
        yield _label(cells[0]), cells[1]


def _follows_status_heading(table):
    """Whether the nearest heading before the table, a few blocks up, names the document status."""
    for steps, sibling in enumerate(table.find_previous_siblings()):
        if steps > 3:
            return False
        if isinstance(sibling, Tag) and sibling.name in HEADINGS:
            return bool(HEADING.search(sibling.get_text(" ", strip=True)))
    return False


def _read_table(table):
    status_cell = by_cell = on_cell = None
    for label, cell in _rows(table):
        if label in STATUS_LABELS and status_cell is None:
            status_cell = cell
        elif label in APPROVED_BY_LABELS and by_cell is None:
            by_cell = cell
        elif label in APPROVED_ON_LABELS and on_cell is None:
            on_cell = cell
    if by_cell is None and on_cell is None:
        # a "Status" row alone is too common (tool registers, project lists) to count
        if status_cell is None or not _follows_status_heading(table):
            return None
    raw_date = _text(on_cell)[:MAX_RAW_DATE] if on_cell is not None else ""
    return LegacyApproval(
        status=_text(status_cell)[:MAX_STATUS] if status_cell is not None else "",
        approved_by=_approver(by_cell) if by_cell is not None else "",
        approved_at=_date_from_cell(on_cell) if on_cell is not None else None,
        approved_at_raw=raw_date,
    )


def parse_document_status(html):
    """The first document status table in the page's HTML, or None.

    None also when the table is there but says nothing (every cell empty).
    Never raises: a page this cannot read simply has no recorded status.
    """
    if not html or "<table" not in html:
        return None
    try:
        soup = BeautifulSoup(html, "html.parser")
        for table in soup.find_all("table"):
            legacy = _read_table(table)
            if legacy is not None and not legacy.is_empty:
                return legacy
    except Exception:  # noqa: BLE001 - hand-made HTML must never break a baseline run
        return None
    return None
