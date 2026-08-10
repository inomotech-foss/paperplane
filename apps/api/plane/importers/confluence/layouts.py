# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Confluence layout types that hold more than one cell, mapped to the column
# weights the editor's columns node takes. Every other type, `fixed-width` and
# `single` among them, is a page-width wrapper rather than a column set.
LAYOUT_RATIOS = {
    "two_equal": "1-1",
    "two_left_sidebar": "1-2",
    "two_right_sidebar": "2-1",
    "three_equal": "1-1-1",
    "three_with_sidebars": "1-2-1",
}


def _column(soup, cell):
    column = soup.new_tag("column-component")
    for child in list(cell.contents):
        column.append(child.extract())
    # The node's content is block+, so an empty cell still needs a block.
    if not column.contents:
        column.append(soup.new_tag("p"))
    return column


def _convert_section(soup, section, ratio):
    columns = soup.new_tag("columns-component")
    columns["layout"] = ratio
    for cell in section.find_all("ac:layout-cell", recursive=False):
        columns.append(_column(soup, cell))
    section.replace_with(columns)


def convert_layouts(soup, result):
    """Multi-column sections become a columns block; anything else is a
    page-width wrapper and simply unwraps."""
    for section in soup.find_all("ac:layout-section"):
        cells = section.find_all("ac:layout-cell", recursive=False)
        if len(cells) < 2:
            continue

        ratio = LAYOUT_RATIOS.get(section.get("ac:type") or "")
        # The cell count matches the type name in every layout Confluence
        # writes, so a mismatch means a shape this mapping does not describe.
        if ratio is None or len(ratio.split("-")) != len(cells):
            result.dropped_layouts += 1
            continue

        _convert_section(soup, section, ratio)

    for name in ("ac:layout-cell", "ac:layout-section", "ac:layout"):
        for node in soup.find_all(name):
            node.unwrap()
