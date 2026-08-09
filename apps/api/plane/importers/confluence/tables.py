# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

_WIDTH = re.compile(r"([\d.]+)\s*px")


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
                colour = cell.get("data-highlight-colour")
                if colour:
                    cell["background"] = colour
                if index < len(widths) and widths[index]:
                    cell["colwidth"] = str(widths[index])
                for attribute in ("data-highlight-colour", "ac:local-id", "data-layout"):
                    cell.attrs.pop(attribute, None)

        for attribute in ("data-layout", "ac:local-id", "data-table-width"):
            table.attrs.pop(attribute, None)
