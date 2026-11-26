# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Bring pages imported before the table normaliser up to date.

The page HTML is rewritten the way a fresh import would now write it. Only the
markup changes: every table cell and every word survives.
"""

from dataclasses import dataclass

from bs4 import BeautifulSoup

from .tables import normalise_tables


@dataclass(frozen=True)
class PageRepair:
    html: str
    tables: int = 0

    @property
    def has_tables(self) -> bool:
        return self.tables > 0


def repair_page_html(html: str) -> PageRepair:
    if not html:
        return PageRepair(html=html)
    soup = BeautifulSoup(html, "html.parser")
    tables = len(soup.find_all("table"))
    if not tables:
        return PageRepair(html=html)
    normalise_tables(soup)
    return PageRepair(html=str(soup), tables=tables)
