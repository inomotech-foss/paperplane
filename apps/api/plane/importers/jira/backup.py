# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class JiraUser:
    account_id: str
    display_name: str = ""
    email: str = ""


@dataclass
class JiraComment:
    id: str
    body: dict = None
    author_id: str = None
    created_at: datetime = None


@dataclass
class JiraIssue:
    key: str
    summary: str
    description: dict = None
    comments: list = field(default_factory=list)
    issue_type: str = ""
    status: str = ""
    priority: str = ""
    resolution: str = ""
    reporter_id: str = None
    assignee_id: str = None
    parent_key: str = None
    labels: list = field(default_factory=list)
    attachments: list = field(default_factory=list)
    created_at: datetime = None
    updated_at: datetime = None


def parse_timestamp(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _named(value):
    """Jira writes most single-select fields as an object carrying a name."""
    if isinstance(value, dict):
        return value.get("name") or value.get("value") or ""
    return value or ""


def _account_id(value):
    return (value or {}).get("accountId") if isinstance(value, dict) else None


def _comments(fields):
    records = (fields.get("comment") or {}).get("comments") or []
    return [
        JiraComment(
            id=str(record.get("id") or ""),
            body=record.get("body") if isinstance(record.get("body"), dict) else None,
            author_id=_account_id(record.get("author")),
            created_at=parse_timestamp(record.get("created")),
        )
        for record in records
    ]


def _attachments(fields):
    return [record.get("filename") or "" for record in (fields.get("attachment") or []) if record.get("filename")]


def _issue_from_record(record):
    fields = record.get("fields") or {}
    description = fields.get("description")
    parent = fields.get("parent") or {}
    return JiraIssue(
        key=str(record.get("key") or ""),
        summary=(fields.get("summary") or "Untitled")[:255],
        description=description if isinstance(description, dict) else None,
        comments=_comments(fields),
        issue_type=_named(fields.get("issuetype")),
        status=_named(fields.get("status")),
        priority=_named(fields.get("priority")),
        resolution=_named(fields.get("resolution")),
        reporter_id=_account_id(fields.get("reporter")),
        assignee_id=_account_id(fields.get("assignee")),
        parent_key=str(parent.get("key")) if parent.get("key") else None,
        labels=[label for label in (fields.get("labels") or []) if label],
        attachments=_attachments(fields),
        created_at=parse_timestamp(fields.get("created")),
        updated_at=parse_timestamp(fields.get("updated")) or parse_timestamp(fields.get("created")),
    )


class JiraBackup:
    """A `backup/jira/<PROJECT_KEY>/` tree as written by the backup tool."""

    def __init__(self, root, project_key):
        self.root = Path(root)
        self.project_key = project_key
        self.project_dir = self.root / "jira" / project_key

    def exists(self):
        return (self.project_dir / "project.json").exists()

    def project(self):
        return json.loads((self.project_dir / "project.json").read_text(encoding="utf-8"))

    def issues(self):
        """Stream `issues.jsonl`, one issue at a time.

        Never split the file with `str.splitlines`: it also breaks on form feed
        and U+2028, both of which occur inside issue bodies, and the halves then
        fail to parse as JSON.
        """
        path = self.project_dir / "issues.jsonl"
        if not path.exists():
            return
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    yield _issue_from_record(json.loads(line))

    def users(self):
        """accountId -> JiraUser, shared across projects."""
        path = self.root / "user_mapping.json"
        if not path.exists():
            return {}
        return {
            entry["accountId"]: JiraUser(
                account_id=entry["accountId"],
                display_name=entry.get("displayName") or "",
                email=(entry.get("emailAddress") or "").strip(),
            )
            for entry in json.loads(path.read_text(encoding="utf-8"))
        }

    def user_mapping(self):
        """accountId -> displayName, shared across projects."""
        return {account_id: user.display_name for account_id, user in self.users().items()}

    def site(self):
        """The Atlassian site this backup was taken from, as a base URL."""
        path = self.root / "manifest.json"
        if not path.exists():
            return ""
        host = (json.loads(path.read_text(encoding="utf-8")).get("site") or "").strip().rstrip("/")
        if not host:
            return ""
        return host if "://" in host else f"https://{host}"

    def attachment_path(self, issue_key, filename):
        return self.project_dir / "attachments" / str(issue_key) / filename

    def attachments(self, issue_key):
        """Every backed-up attachment for an issue, in a stable order."""
        directory = self.project_dir / "attachments" / str(issue_key)
        if not directory.is_dir():
            return []
        return sorted(path for path in directory.iterdir() if path.is_file() and not path.name.startswith(("~", ".")))


def project_keys(root):
    """Every project backed up under `root`, in a stable order."""
    directory = Path(root) / "jira"
    if not directory.is_dir():
        return []
    return sorted(path.name for path in directory.iterdir() if (path / "project.json").exists())
