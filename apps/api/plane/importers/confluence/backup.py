# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import html
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

# Content types a page can hang off that the backup tool never fetched.
CONTAINER_TYPES = ("folder", "database")

SORT_STEP = 10000

_CONTAINER_LINK = re.compile(r'<a\s[^>]*href="[^"]*/(folder|database)/(\d+)[^"]*"[^>]*>(.*?)</a>', re.S)
_TAG = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class ConfluenceUser:
    account_id: str
    display_name: str = ""
    email: str = ""


@dataclass
class ConfluencePage:
    id: str
    title: str
    body: str
    parent_id: str = None
    # "page", "folder" or "database"; None for a root.
    parent_type: str = None
    # Order among siblings, as Confluence stored it.
    position: int = None
    archived: bool = False
    # Stands in for a container the backup does not hold.
    placeholder: bool = False
    author_id: str = None
    created_at: datetime = None
    updated_at: datetime = None
    version: int = 1
    labels: list = field(default_factory=list)


def parse_timestamp(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _label_name(label):
    # The export writes {"id", "name", "prefix"} objects, not bare names.
    return (label.get("name") if isinstance(label, dict) else label) or ""


def _position(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _page_from_record(record):
    version = record.get("version") or {}
    parent_id = record.get("parentId")
    # The backup writes a literal "None" string for absent parents.
    parent_id = str(parent_id) if parent_id and str(parent_id) != "None" else None
    return ConfluencePage(
        id=str(record["id"]),
        title=(record.get("title") or "Untitled")[:255],
        body=((record.get("body") or {}).get("storage") or {}).get("value") or "",
        parent_id=parent_id,
        parent_type=(record.get("parentType") or "page") if parent_id else None,
        position=_position(record.get("position")),
        archived=(record.get("status") or "") == "archived",
        author_id=record.get("authorId") or record.get("ownerId"),
        created_at=parse_timestamp(record.get("createdAt")),
        updated_at=parse_timestamp(version.get("createdAt")) or parse_timestamp(record.get("createdAt")),
        version=int(version.get("number") or 1),
        labels=[name for name in map(_label_name, record.get("labels") or []) if name],
    )


_TEMPLATE_CONTAINER = "_root"
_TEMPLATE_TRASH = "_trash"


def _subtree(pages, seeds):
    found = set(seeds)
    growing = True
    while growing:
        growing = False
        for page in pages:
            if page.parent_id in found and page.id not in found:
                found.add(page.id)
                growing = True
    return found


def drop_template_scaffolding(pages):
    """Remove the bookkeeping pages a Confluence template system leaves behind.

    Template-based spaces nest their whole tree under an empty `_root` page and
    park deleted content under `_trash`. The container is unwrapped rather than
    dropped, because everything real hangs off it.
    """
    known = {page.id for page in pages}
    roots = [page for page in pages if page.parent_id not in known]
    trashed = {page.id for page in roots if page.title == _TEMPLATE_TRASH}
    # A `_root` holding a body is someone's real page, so leave it alone.
    containers = {page.id for page in roots if page.title == _TEMPLATE_CONTAINER and not page.body.strip()}
    if not trashed and not containers:
        return pages

    removed = _subtree(pages, trashed) | containers
    kept = []
    for page in pages:
        if page.id in removed:
            continue
        if page.parent_id in containers:
            page.parent_id = None
        kept.append(page)
    return kept


def _container_names(pages):
    """Container titles recoverable from links, keyed by (type, id).

    Most links to a folder show the URL as their text, which is no name at all,
    so only text that is not a URL counts.
    """
    names = {}
    for page in pages:
        for kind, container_id, text in _CONTAINER_LINK.findall(page.body):
            text = html.unescape(_TAG.sub("", text)).strip()
            if text and "://" not in text:
                names.setdefault((kind, container_id), text[:255])
    return names


def add_container_placeholders(pages):
    """Stand in for the folders and databases the backup never fetched.

    The export only holds pages, so a page kept in a folder points at an id
    with no record and would otherwise land at the root. One placeholder page
    per container keeps its pages together. The container's own title and
    parent are gone, so the placeholder sits at the root under whatever name a
    link to it reveals, or its id, for a human to fix.
    """
    known = {page.id for page in pages}
    orphans = [
        page for page in pages if page.parent_type in CONTAINER_TYPES and page.parent_id and page.parent_id not in known
    ]
    if not orphans:
        return pages

    names = _container_names(pages)
    placeholders = {}
    for page in orphans:
        key = (page.parent_type, page.parent_id)
        placeholder = placeholders.get(key)
        if placeholder is None:
            placeholder = placeholders[key] = ConfluencePage(
                id=f"{page.parent_type}-{page.parent_id}",
                title=names.get(key) or f"{page.parent_type.capitalize()} {page.parent_id}",
                body="",
                placeholder=True,
                created_at=page.created_at,
                updated_at=page.updated_at,
            )
        else:
            stamps = [stamp for stamp in (placeholder.created_at, page.created_at) if stamp]
            placeholder.created_at = min(stamps) if stamps else None
            stamps = [stamp for stamp in (placeholder.updated_at, page.updated_at) if stamp]
            placeholder.updated_at = max(stamps) if stamps else None
        page.parent_id = placeholder.id
        page.parent_type = "page"
    return pages + list(placeholders.values())


def sibling_sort_orders(pages):
    """Plane `sort_order` per page id, from Confluence's sibling position.

    Positions only mean something among siblings, so each parent's children are
    ranked and spaced `SORT_STEP` apart to leave room for a manual reorder.
    Placeholders carry no position and go last, by title.
    """
    known = {page.id for page in pages}
    siblings = defaultdict(list)
    for page in pages:
        siblings[page.parent_id if page.parent_id in known else None].append(page)

    orders = {}
    for group in siblings.values():
        group.sort(key=lambda page: (page.position is None, page.position or 0, page.title.casefold()))
        for rank, page in enumerate(group, start=1):
            orders[page.id] = rank * SORT_STEP
    return orders


class ConfluenceBackup:
    """A `backup/confluence/<SPACE>/` tree as written by the backup tool."""

    def __init__(self, root, space_key):
        self.root = Path(root)
        self.space_key = space_key
        self.space_dir = self.root / "confluence" / space_key

    def exists(self):
        return (self.space_dir / "space.json").exists()

    def space(self):
        return json.loads((self.space_dir / "space.json").read_text())

    def space_type(self):
        """The space's Confluence type, e.g. "global" or "personal".

        Returns "" if space.json has no "type" key, is missing, or fails to parse.
        """
        try:
            return (self.space().get("type") or "").strip()
        except (OSError, ValueError):
            return ""

    def space_status(self):
        """The space's Confluence status, "current" or "archived"; "" if unknown."""
        try:
            return (self.space().get("status") or "").strip()
        except (OSError, ValueError):
            return ""

    def space_owner_id(self):
        try:
            return (self.space().get("spaceOwnerId") or "").strip()
        except (OSError, ValueError):
            return ""

    def pages(self):
        path = self.space_dir / "pages.jsonl"
        with path.open() as handle:
            pages = [_page_from_record(json.loads(line)) for line in handle if line.strip()]
        return add_container_placeholders(drop_template_scaffolding(pages))

    def users(self):
        """accountId -> ConfluenceUser, shared across spaces."""
        path = self.root / "user_mapping.json"
        if not path.exists():
            return {}
        return {
            entry["accountId"]: ConfluenceUser(
                account_id=entry["accountId"],
                display_name=entry.get("displayName") or "",
                email=(entry.get("emailAddress") or "").strip(),
            )
            for entry in json.loads(path.read_text())
        }

    def user_mapping(self):
        """accountId -> displayName, shared across spaces."""
        return {account_id: user.display_name for account_id, user in self.users().items()}

    def site(self):
        """The Atlassian site this backup was taken from, as a base URL."""
        path = self.root / "manifest.json"
        if not path.exists():
            return ""
        host = (json.loads(path.read_text()).get("site") or "").strip().rstrip("/")
        if not host:
            return ""
        return host if "://" in host else f"https://{host}"

    def jira_project_keys(self):
        """Every Jira project key known to live on `site`."""
        path = self.root / "jira" / "projects.json"
        if not path.exists():
            return set()
        keys = {(project.get("key") or "").strip().upper() for project in json.loads(path.read_text())}
        return keys - {""}

    def attachment_path(self, page_id, filename):
        return self.space_dir / "attachments" / str(page_id) / filename

    def attachments(self, page_id):
        """Every backed-up attachment for a page, in a stable order.

        Editors leave working copies behind - draw.io writes `~<name>.tmp`
        beside the diagram - so anything starting with `~` or `.` is skipped.
        """
        directory = self.space_dir / "attachments" / str(page_id)
        if not directory.is_dir():
            return []
        return sorted(path for path in directory.iterdir() if path.is_file() and not path.name.startswith(("~", ".")))


def space_keys(root, include_personal=False):
    """Every space backed up under `root`, in a stable order.

    Personal spaces (space.json's "type" == "personal") are skipped unless
    `include_personal` is set.
    """
    directory = Path(root) / "confluence"
    if not directory.is_dir():
        return []
    keys = sorted(path.name for path in directory.iterdir() if (path / "space.json").exists())
    if include_personal:
        return keys
    return [key for key in keys if ConfluenceBackup(root, key).space_type() != "personal"]


def order_parents_first(pages):
    """Order pages so a parent is always placed before its children.

    Pages whose parent is outside the space are treated as roots, and any cycle
    is appended at the end rather than dropped.
    """
    by_id = {page.id: page for page in pages}
    ordered, placed = [], set()

    frontier = [page for page in pages if page.parent_id not in by_id]
    while frontier:
        for page in frontier:
            ordered.append(page)
            placed.add(page.id)
        frontier = [
            page for page in pages if page.id not in placed and page.parent_id in placed and page.parent_id is not None
        ]

    ordered.extend(page for page in pages if page.id not in placed)
    return ordered
