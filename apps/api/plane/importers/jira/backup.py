# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

# Custom fields are identified by id, not by name. `fields.json` lists a second
# Epic Link and a second sprint field on this site; only these three hold data.
EPIC_LINK_FIELD = "customfield_10014"
RANK_FIELD = "customfield_10019"
SPRINT_FIELD = "customfield_10020"
MODELLED_CUSTOM_FIELDS = frozenset({EPIC_LINK_FIELD, RANK_FIELD, SPRINT_FIELD})


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


@dataclass(frozen=True)
class JiraSprint:
    id: str
    name: str
    state: str = ""
    board_id: str = ""
    goal: str = ""
    start_at: datetime = None
    end_at: datetime = None
    completed_at: datetime = None


@dataclass(frozen=True)
class JiraLink:
    id: str
    type_name: str
    other_key: str
    outward: bool


@dataclass
class JiraChange:
    id: str
    field_name: str
    author_id: str = None
    created_at: datetime = None
    old_value: str = ""
    new_value: str = ""


@dataclass
class JiraIssue:
    key: str
    summary: str
    description: dict = None
    comments: list = field(default_factory=list)
    issue_type: str = ""
    status: str = ""
    status_category: str = ""
    priority: str = ""
    resolution: str = ""
    creator_id: str = None
    reporter_id: str = None
    assignee_id: str = None
    parent_key: str = None
    epic_key: str = None
    subtask_keys: list = field(default_factory=list)
    links: list = field(default_factory=list)
    labels: list = field(default_factory=list)
    components: list = field(default_factory=list)
    fix_versions: list = field(default_factory=list)
    sprints: list = field(default_factory=list)
    rank: str = ""
    changelog: list = field(default_factory=list)
    watcher_ids: list = field(default_factory=list)
    voter_ids: list = field(default_factory=list)
    worklogs: int = 0
    chrome: list = field(default_factory=list)
    attachments: list = field(default_factory=list)
    created_at: datetime = None
    updated_at: datetime = None
    resolved_at: datetime = None
    due_date: str = ""


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


def _status_category(fields):
    """The workflow bucket a status sits in, as one of four stable keys.

    Status names run to the dozens and are renamed freely; the category is what
    every Jira site agrees on.
    """
    status = fields.get("status")
    if not isinstance(status, dict):
        return ""
    category = status.get("statusCategory")
    if not isinstance(category, dict):
        return ""
    return str(category.get("key") or category.get("name") or "")


def _names(values):
    return [name for name in (_named(value) for value in (values or [])) if name]


def _nested(value, key):
    return (value.get(key) or []) if isinstance(value, dict) else []


def _account_ids(records):
    return [account_id for account_id in (_account_id(record) for record in records) if account_id]


def _sprints(fields):
    """Sprints as the issue carries them.

    `sprints.json` cannot be used: the board endpoints 404'd during the backup
    and the last incremental run truncated the file, so the issues are the only
    complete record of which sprint an issue was in.
    """
    sprints = []
    for record in fields.get(SPRINT_FIELD) or []:
        if not isinstance(record, dict) or not record.get("id"):
            continue
        sprints.append(
            JiraSprint(
                id=str(record["id"]),
                name=str(record.get("name") or f"Sprint {record['id']}"),
                state=str(record.get("state") or "").strip().casefold(),
                board_id=str(record.get("boardId") or ""),
                goal=str(record.get("goal") or ""),
                start_at=parse_timestamp(record.get("startDate")),
                end_at=parse_timestamp(record.get("endDate")),
                completed_at=parse_timestamp(record.get("completeDate")),
            )
        )
    return sprints


def _links(fields):
    links = []
    for record in fields.get("issuelinks") or []:
        if not isinstance(record, dict):
            continue
        outward = record.get("outwardIssue") or {}
        other = outward or record.get("inwardIssue") or {}
        if not other.get("key"):
            continue
        links.append(
            JiraLink(
                id=str(record.get("id") or ""),
                type_name=_named(record.get("type")),
                other_key=str(other["key"]),
                outward=bool(outward),
            )
        )
    return links


def _changelog(record):
    """The audit trail, flattened to one entry per changed field.

    Jira groups the fields a person touched in one action under a single
    history; Plane records one activity per field, so the group is expanded.
    """
    changes = []
    for history in _nested(record.get("changelog"), "histories"):
        author_id = _account_id(history.get("author"))
        created_at = parse_timestamp(history.get("created"))
        for index, item in enumerate(history.get("items") or []):
            changes.append(
                JiraChange(
                    id=f"{history.get('id') or ''}-{index}",
                    field_name=str(item.get("field") or item.get("fieldId") or ""),
                    author_id=author_id,
                    created_at=created_at,
                    old_value=str(item.get("fromString") or item.get("from") or ""),
                    new_value=str(item.get("toString") or item.get("to") or ""),
                )
            )
    return changes


def _chrome(fields):
    """Custom fields holding data no Plane model can take."""
    return sorted(
        key
        for key, value in fields.items()
        if key.startswith("customfield_") and key not in MODELLED_CUSTOM_FIELDS and value not in (None, "", [], {})
    )


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
        status_category=_status_category(fields),
        priority=_named(fields.get("priority")),
        resolution=_named(fields.get("resolution")),
        creator_id=_account_id(fields.get("creator")),
        reporter_id=_account_id(fields.get("reporter")),
        assignee_id=_account_id(fields.get("assignee")),
        parent_key=str(parent.get("key")) if parent.get("key") else None,
        epic_key=str(fields[EPIC_LINK_FIELD]) if isinstance(fields.get(EPIC_LINK_FIELD), str) else None,
        subtask_keys=[
            str(sub["key"]) for sub in (fields.get("subtasks") or []) if isinstance(sub, dict) and sub.get("key")
        ],
        links=_links(fields),
        labels=[label for label in (fields.get("labels") or []) if label],
        components=_names(fields.get("components")),
        fix_versions=_names(fields.get("fixVersions")),
        sprints=_sprints(fields),
        rank=str(fields.get(RANK_FIELD) or ""),
        changelog=_changelog(record),
        watcher_ids=_account_ids(_nested(fields.get("watches"), "watchers")),
        voter_ids=_account_ids(_nested(fields.get("votes"), "voters")),
        worklogs=len(_nested(fields.get("worklog"), "worklogs")),
        chrome=_chrome(fields),
        attachments=_attachments(fields),
        created_at=parse_timestamp(fields.get("created")),
        updated_at=parse_timestamp(fields.get("updated")) or parse_timestamp(fields.get("created")),
        resolved_at=parse_timestamp(fields.get("resolutiondate")),
        due_date=fields.get("duedate") or "",
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


def issue_number(key):
    """`DEMO-6` -> 6, the number Plane keeps as the issue's sequence id."""
    _, _, number = str(key or "").rpartition("-")
    try:
        return int(number)
    except ValueError:
        return None


def project_keys(root):
    """Every project backed up under `root`, in a stable order."""
    directory = Path(root) / "jira"
    if not directory.is_dir():
        return []
    return sorted(path.name for path in directory.iterdir() if (path / "project.json").exists())
