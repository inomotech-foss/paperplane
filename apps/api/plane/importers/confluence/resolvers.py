# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from collections import Counter
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ResolvedUser:
    id: str
    display_name: str


@dataclass(frozen=True)
class ResolvedAttachment:
    # `id` is what the editor's image node stores; `url` is only for download links.
    id: str
    filename: str
    is_image: bool
    url: str = ""


@dataclass(frozen=True)
class ResolvedPage:
    id: str
    url: str
    title: str


@dataclass(frozen=True)
class ResolvedJiraIssue:
    """An imported Jira work item, as the editor's issue embed needs it."""

    id: str
    project_id: str
    workspace_id: str


class Resolvers:
    """Lookups the converter cannot perform itself.

    Every lookup may return None; the converter degrades to readable text and
    records the miss, so a partial map still produces a usable page.
    """

    def __init__(self, users=None, attachments=None, pages=None, jira_base_urls=None, jira_issues=None):
        self._users = users or {}
        self._attachments = attachments or {}
        self._pages = pages or {}
        self._jira_base_urls = jira_base_urls or {}
        self._jira_issues = jira_issues or {}

    def user(self, account_id):
        return self._users.get(account_id)

    def attachment(self, filename):
        return self._attachments.get(filename)

    def page(self, title, space_key=None):
        if space_key is not None and (space_key, title) in self._pages:
            return self._pages[(space_key, title)]
        return self._pages.get(title)

    def page_by_id(self, page_id):
        """Some macros name a page by its Confluence id rather than its title.

        Keyed under a tuple so a numeric id can never collide with a page
        actually titled "100".
        """
        return self._pages.get(("id", str(page_id))) if page_id else None

    def jira_base_url(self, server_id):
        return self._jira_base_urls.get(server_id)

    def jira_issue(self, project_key, sequence_id):
        """The imported work item a Jira key such as ``DEMO-12`` became.

        Keyed by project identifier plus sequence id rather than the key
        itself, so a project renamed after import still resolves.
        """
        if not project_key or sequence_id is None:
            return None
        return self._jira_issues.get((project_key.upper(), sequence_id))


@dataclass
class ConversionResult:
    """What a page conversion cost. Only the first group is loss: ``downgraded``
    survived in a lesser form and ``dropped_chrome`` never held content."""

    html: str
    unsupported_macros: Counter = field(default_factory=Counter)
    unresolved_users: set = field(default_factory=set)
    unresolved_attachments: set = field(default_factory=set)
    unresolved_pages: set = field(default_factory=set)
    dropped_layouts: int = 0
    downgraded: Counter = field(default_factory=Counter)
    dropped_chrome: Counter = field(default_factory=Counter)
    # Facts the page can be queried on, not a cost. See page_index.py.
    index_entries: list = field(default_factory=list)

    @property
    def is_lossless(self):
        return not (
            self.unsupported_macros
            or self.unresolved_users
            or self.unresolved_attachments
            or self.unresolved_pages
            or self.dropped_layouts
        )
