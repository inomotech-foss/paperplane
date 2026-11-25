# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Bring pages imported before the table and include fixes up to date.

The page HTML is rewritten the way a fresh import would now write it. Only the
markup changes: every table cell and every word survives, and the only text
removed is the title of a snippet link that becomes an include block.
"""

from dataclasses import dataclass, field

from bs4 import BeautifulSoup

from .includes import convert_include_links
from .tables import normalise_tables

# The page the Confluence space kept its include snippets under.
SNIPPETS_PARENT_NAME = "_snippets"


@dataclass
class PageRepair:
    html: str
    tables: int = 0
    includes: list = field(default_factory=list)

    @property
    def has_tables(self):
        return self.tables > 0


def repair_page_html(html, include_page_ids=()):
    """Normalise the tables and turn snippet links into include blocks.

    Tables first: a link that is a cell's only content becomes a paragraph of
    its own there, which is the shape `convert_include_links` looks for.
    """
    if not html:
        return PageRepair(html=html)
    soup = BeautifulSoup(html, "html.parser")
    tables = len(soup.find_all("table"))
    if tables:
        normalise_tables(soup)
    includes = convert_include_links(soup, include_page_ids) if include_page_ids else []
    if not tables and not includes:
        return PageRepair(html=html)
    return PageRepair(html=str(soup), tables=tables, includes=includes)
