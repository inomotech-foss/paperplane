# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import mimetypes
from collections import Counter
from dataclasses import dataclass, field

from .backup import ConfluenceBackup, space_keys
from .resolvers import ConversionResult, ResolvedAttachment, ResolvedPage, ResolvedUser, Resolvers
from .storage import storage_to_html


@dataclass
class PageReport:
    id: str
    title: str
    unsupported_macros: Counter = field(default_factory=Counter)
    unresolved_users: int = 0
    unresolved_attachments: int = 0
    unresolved_pages: int = 0
    dropped_layouts: int = 0

    @property
    def loss(self):
        """How many constructs on this page do not survive conversion."""
        return (
            sum(self.unsupported_macros.values())
            + self.unresolved_users
            + self.unresolved_attachments
            + self.unresolved_pages
            + self.dropped_layouts
        )

    @property
    def is_lossless(self):
        return self.loss == 0


@dataclass
class SpaceReport:
    key: str
    name: str = ""
    pages: int = 0
    lossless: int = 0
    unsupported_macros: Counter = field(default_factory=Counter)
    unresolved_users: set = field(default_factory=set)
    unresolved_attachments: set = field(default_factory=set)
    unresolved_pages: set = field(default_factory=set)
    dropped_layouts: int = 0
    worst: list = field(default_factory=list)

    @property
    def fidelity(self):
        """Share of pages that convert with nothing lost. An empty space is not
        a problem to triage, so it scores as clean."""
        return 1.0 if self.pages == 0 else self.lossless / self.pages


def _attachment_resolvers(backup, page_id):
    """What the importer would find on disk for this page.

    Only presence matters here - nothing is uploaded - so the ids are blank.
    """
    resolved = {}
    for path in backup.attachments(page_id):
        content_type = mimetypes.guess_type(path.name)[0] or ""
        resolved[path.name] = ResolvedAttachment(
            id="",
            filename=path.name,
            is_image=content_type.startswith("image/"),
        )
    return resolved


def _page_resolvers(pages):
    return {page.title: ResolvedPage(id="", url="", title=page.title) for page in pages}


def _titles_across(root, keys):
    page_map = {}
    for key in keys:
        page_map.update(_page_resolvers(ConfluenceBackup(root, key).pages()))
    return page_map


def _user_resolvers(backup):
    """The backup's own account map. A reference the map does not cover cannot
    be attributed by any import, whoever is in the workspace."""
    return {
        account_id: ResolvedUser(id="", display_name=display_name)
        for account_id, display_name in backup.user_mapping().items()
    }


def report_space(backup, limit=None, pages=None, page_map=None):
    """Converts every page in a space and records what degrades.

    This reads the backup only. Nothing is written, no storage is touched, and
    the resolvers answer from the backup itself, so the numbers describe what
    the conversion can do rather than what one particular workspace contains.

    ``page_map`` carries titles from the other spaces in the same run, because
    Confluence links pages by title and titles cross spaces freely.
    """
    space = backup.space()
    report = SpaceReport(key=backup.space_key, name=space.get("name", ""))

    pages = backup.pages() if pages is None else pages
    if limit is not None:
        pages = pages[:limit]

    users = _user_resolvers(backup)
    page_map = _page_resolvers(pages) if page_map is None else page_map

    for page in pages:
        resolvers = Resolvers(
            users=users,
            attachments=_attachment_resolvers(backup, page.id),
            pages=page_map,
        )
        result = storage_to_html(page.body, resolvers, ConversionResult(html=""))

        page_report = PageReport(
            id=page.id,
            title=page.title,
            unsupported_macros=Counter(result.unsupported_macros),
            unresolved_users=len(result.unresolved_users),
            unresolved_attachments=len(result.unresolved_attachments),
            unresolved_pages=len(result.unresolved_pages),
            dropped_layouts=result.dropped_layouts,
        )

        report.pages += 1
        if page_report.is_lossless:
            report.lossless += 1
        else:
            report.worst.append(page_report)

        report.unsupported_macros.update(result.unsupported_macros)
        report.unresolved_users |= result.unresolved_users
        report.unresolved_attachments |= result.unresolved_attachments
        report.unresolved_pages |= result.unresolved_pages
        report.dropped_layouts += result.dropped_layouts

    report.worst.sort(key=lambda item: item.loss, reverse=True)
    return report


def report_backup(root, spaces=None, limit=None, global_page_map=False):
    """Every space in a backup, worst fidelity first - the triage order.

    Link targets resolve against every space in the run, matching an import of
    those same spaces. ``global_page_map`` widens that to every backed-up space,
    so a single-space run scores its links the way a full import would, at the
    cost of reading the whole backup.
    """
    keys = list(spaces) if spaces else space_keys(root)
    backups = {key: ConfluenceBackup(root, key) for key in keys}
    pages = {key: backup.pages() for key, backup in backups.items()}

    page_map = _page_resolvers(page for space_pages in pages.values() for page in space_pages)
    if global_page_map:
        page_map = _titles_across(root, [key for key in space_keys(root) if key not in pages]) | page_map

    reports = [report_space(backups[key], limit=limit, pages=pages[key], page_map=page_map) for key in keys]
    reports.sort(key=lambda report: (report.fidelity, -report.pages))
    return reports
