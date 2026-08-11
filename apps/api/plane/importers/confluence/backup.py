# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class ConfluencePage:
    id: str
    title: str
    body: str
    parent_id: str = None
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


def _page_from_record(record):
    version = record.get("version") or {}
    parent_id = record.get("parentId")
    return ConfluencePage(
        id=str(record["id"]),
        title=(record.get("title") or "Untitled")[:255],
        body=((record.get("body") or {}).get("storage") or {}).get("value") or "",
        # The backup writes a literal "None" string for absent parents.
        parent_id=str(parent_id) if parent_id and str(parent_id) != "None" else None,
        author_id=record.get("authorId") or record.get("ownerId"),
        created_at=parse_timestamp(record.get("createdAt")),
        updated_at=parse_timestamp(version.get("createdAt")) or parse_timestamp(record.get("createdAt")),
        version=int(version.get("number") or 1),
        labels=[name for name in map(_label_name, record.get("labels") or []) if name],
    )


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

    def pages(self):
        path = self.space_dir / "pages.jsonl"
        with path.open() as handle:
            return [_page_from_record(json.loads(line)) for line in handle if line.strip()]

    def user_mapping(self):
        """accountId -> displayName, shared across spaces."""
        path = self.root / "user_mapping.json"
        if not path.exists():
            return {}
        return {entry["accountId"]: entry.get("displayName", "") for entry in json.loads(path.read_text())}

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


def space_keys(root):
    """Every space backed up under `root`, in a stable order."""
    directory = Path(root) / "confluence"
    if not directory.is_dir():
        return []
    return sorted(path.name for path in directory.iterdir() if (path / "space.json").exists())


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
