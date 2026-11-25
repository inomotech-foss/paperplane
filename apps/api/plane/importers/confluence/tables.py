# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

from bs4 import BeautifulSoup, NavigableString, Tag

from .colours import background_variable, palette_colour

_WIDTH = re.compile(r"([\d.]+)\s*px")

# The editor's content column in its normal layout. Confluence measured its
# widths against a wider page; fixed widths summing to more than this make the
# table scroll sideways with every column still narrow, so such a table is left
# fluid instead: no widths, the full width of the page, whichever layout it is in.
MAX_TABLE_WIDTH = 720

# The width given to the label column of a key/value table (every row opens
# with a header cell). The value column takes the rest of the content width.
KEY_COLUMN_WIDTH = 200

# What the editor gives every cell of a table made with `insertTable`, and what
# it used to give any cell parsed without a width. A table whose every cell has
# exactly this width carries no layout of its own.
EDITOR_DEFAULT_WIDTH = "150"

# Cell children that are blocks in the editor schema. Anything else is inline
# content and needs a paragraph around it.
BLOCK_TAGS = {
    "p",
    "div",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "blockquote",
    "pre",
    "hr",
    "query-block-component",
    "page-attachments-component",
    "child-pages-component",
    "toc-component",
    "diagram-component",
    "columns-component",
    "embed-component",
    "math-block-component",
    "issue-embed-component",
}

# Confluence presentation classes the editor has no use for: "wrapped" and
# "relative-table" on the table, "highlight-<colour>" on a cell, whose colour
# is already the `background` attribute, "confluenceTd" and friends.
_CONFLUENCE_CLASS = re.compile(r"^(wrapped|relative-table|highlight-[\w-]+|confluence\w+|numberingColumn)$")


def _column_widths(table):
    widths = []
    for col in table.select("colgroup > col"):
        match = _WIDTH.search(col.get("style") or "")
        widths.append(int(float(match.group(1))) if match else None)
    return widths


def convert_tables(soup, result):
    """Map Confluence table presentation onto the editor's own attributes.

    Anything the editor schema has no attribute for is dropped here rather
    than left to be silently stripped later.
    """
    for table in soup.find_all("table"):
        # Every cell survives, so narrowing a full-width table is not loss.
        if table.get("data-layout") not in (None, "default"):
            result.downgraded["table-width"] += 1

        widths = _column_widths(table)
        for colgroup in table.find_all("colgroup"):
            colgroup.decompose()

        for row in table.find_all("tr"):
            for index, cell in enumerate(row.find_all(["td", "th"], recursive=False)):
                colour = palette_colour(cell.get("data-highlight-colour"))
                if colour:
                    cell["background"] = background_variable(colour)
                    result.downgraded["table-highlight"] += 1
                if index < len(widths) and widths[index]:
                    cell["colwidth"] = str(widths[index])
                for attribute in ("data-highlight-colour", "ac:local-id", "data-layout"):
                    cell.attrs.pop(attribute, None)

        for attribute in ("data-layout", "ac:local-id", "data-table-width"):
            table.attrs.pop(attribute, None)


def normalise_tables_html(html):
    """`normalise_tables` over an HTML string. Returns the string unchanged when
    there is no table in it, so a page without one is never re-serialised."""
    if "<table" not in (html or ""):
        return html
    soup = BeautifulSoup(html, "html.parser")
    normalise_tables(soup)
    return str(soup)


def normalise_tables(soup):
    """Bring Confluence table markup into the shape the editor schema reads.

    Idempotent, and it never drops a cell or any of its text.
    """
    for table in soup.find_all("table"):
        _drop_confluence_classes(table)
        # "width: 88%" from a relative-width table; the editor sizes by column
        if "width" in (table.get("style") or ""):
            del table["style"]

        rows = _rows(table)
        for row in rows:
            for cell in _cells(row):
                _normalise_cell(soup, cell)
        _normalise_widths(rows)


def _rows(table):
    """The table's own rows, not those of a table nested in one of its cells."""
    return [row for row in table.find_all("tr") if row.find_parent("table") is table]


def _cells(row):
    return row.find_all(["td", "th"], recursive=False)


def _drop_confluence_classes(node):
    classes = [name for name in (node.get("class") or []) if not _CONFLUENCE_CLASS.match(name)]
    if classes:
        node["class"] = classes
    else:
        node.attrs.pop("class", None)


def _normalise_cell(soup, cell):
    _drop_confluence_classes(cell)
    for attribute in ("colspan", "rowspan"):
        if cell.get(attribute) == "1":
            del cell[attribute]

    # Confluence wraps the content of a cell holding a macro or a block in
    # this div. The editor reads its children either way; unwrapping keeps the
    # HTML the API and the page index read the same as what the editor shows.
    for wrapper in cell.find_all("div", class_="content-wrapper", recursive=False):
        wrapper.unwrap()

    _wrap_inline_runs(soup, cell)


def _is_block(node):
    return isinstance(node, Tag) and node.name in BLOCK_TAGS


def _is_blank(node):
    return isinstance(node, NavigableString) and not node.strip()


def _wrap_inline_runs(soup, cell):
    """A cell holds blocks. Text or inline markup sitting directly in it goes
    into a paragraph, one per run between blocks; an empty cell gets an empty
    paragraph."""
    run = []

    def flush():
        if any(not _is_blank(node) for node in run):
            # whitespace at the edges of a run is formatting, not content
            while _is_blank(run[0]):
                run.pop(0).extract()
            while _is_blank(run[-1]):
                run.pop().extract()
            paragraph = soup.new_tag("p")
            run[0].insert_before(paragraph)
            for node in run:
                paragraph.append(node.extract())
        else:
            for node in run:
                node.extract()
        run.clear()

    for child in list(cell.contents):
        if _is_block(child):
            flush()
        else:
            run.append(child)
    flush()

    if not cell.contents:
        cell.append(soup.new_tag("p"))


def _widths(cell):
    try:
        return [int(part) for part in (cell.get("colwidth") or "").split(",") if part.strip()]
    except ValueError:
        return []


def _span(cell):
    try:
        return max(1, int(cell.get("colspan") or 1))
    except ValueError:
        return 1


def _normalise_widths(rows):
    cells = [cell for row in rows for cell in _cells(row)]
    if not cells:
        return

    # A uniform default is what an earlier editor wrote for a table that had
    # no widths of its own; it pins every column to 150px.
    if all(cell.get("colwidth") == EDITOR_DEFAULT_WIDTH and _span(cell) == 1 for cell in cells):
        for cell in cells:
            del cell["colwidth"]

    if any(cell.get("colwidth") for cell in cells):
        _fit_widths(rows)
    if any(cell.get("colwidth") for cell in cells):
        return

    if _is_key_value_table(rows):
        for row in rows:
            _cells(row)[0]["colwidth"] = str(KEY_COLUMN_WIDTH)


def _is_key_value_table(rows):
    """Every row opens with a single-column header cell and holds more than it:
    a label column, which reads best narrow, with the values beside it. A table
    whose first row is all headers has a header row instead."""
    if len(rows) < 2:
        return False
    first = _cells(rows[0])
    if first and all(cell.name == "th" for cell in first):
        return False
    for row in rows:
        cells = _cells(row)
        if len(cells) < 2 or cells[0].name != "th" or _span(cells[0]) != 1:
            return False
    return True


def _fit_widths(rows):
    """Keep explicit widths that fit MAX_TABLE_WIDTH; drop them all otherwise.

    Scaling would keep the proportions but not the fit: the table extension
    gives no column less than 100px, and a fixed-width table cannot follow the
    page into its full-width layout. A fluid table does both.
    """
    widest = max((sum(sum(_widths(cell)) for cell in _cells(row)) for row in rows), default=0)
    if widest <= MAX_TABLE_WIDTH:
        return
    for row in rows:
        for cell in _cells(row):
            cell.attrs.pop("colwidth", None)
