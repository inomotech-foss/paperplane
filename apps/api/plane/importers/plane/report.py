# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from collections import Counter, defaultdict
from dataclasses import dataclass, field


@dataclass
class ImportReport:
    """What the import wrote, changed and left out.

    Every source row the importer does not write lands in ``dropped`` with its
    reason, and every reference it could not keep in ``nulled``: nothing is
    lost silently.
    """

    written: dict = field(default_factory=dict)
    dropped: defaultdict = field(default_factory=lambda: defaultdict(Counter))
    nulled: Counter = field(default_factory=Counter)
    matched_users: int = 0
    renamed_users: list = field(default_factory=list)
    typed: int = 0
    typed_projects: int = 0
    type_icons: int = 0
    page_links: int = 0
    relations_downgraded: int = 0
    file_objects: int = 0
    skipped: dict = field(default_factory=dict)
    unknown: dict = field(default_factory=dict)
    dry_run: bool = False
