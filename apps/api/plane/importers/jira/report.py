# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import mimetypes
from dataclasses import dataclass, field

from ..confluence.resolvers import ResolvedAttachment, ResolvedUser, Resolvers
from .adf import AdfResult, Tally, adf_to_html
from .backup import JiraBackup, project_keys


@dataclass
class IssueReport:
    key: str
    summary: str
    documents: int = 0
    nodes: Tally = field(default_factory=Tally)
    marks: Tally = field(default_factory=Tally)
    unresolved_users: set = field(default_factory=set)
    unresolved_attachments: set = field(default_factory=set)

    @property
    def loss(self):
        """How many constructs on this issue do not survive conversion."""
        return sum(self.nodes.lost.values()) + sum(self.marks.lost.values())

    @property
    def is_lossless(self):
        return not (self.loss or self.unresolved_users or self.unresolved_attachments)


@dataclass
class ProjectReport:
    key: str
    name: str = ""
    issues: int = 0
    documents: int = 0
    lossless: int = 0
    nodes: Tally = field(default_factory=Tally)
    marks: Tally = field(default_factory=Tally)
    unresolved_users: set = field(default_factory=set)
    unresolved_attachments: set = field(default_factory=set)
    worst: list = field(default_factory=list)

    @property
    def fidelity(self):
        """Share of issues that convert with nothing lost. An empty project is
        not a problem to triage, so it scores as clean."""
        return 1.0 if self.issues == 0 else self.lossless / self.issues


def _user_resolvers(backup):
    """The backup's own account map. A reference the map does not cover cannot
    be attributed by any import, whoever is in the workspace."""
    return {
        account_id: ResolvedUser(id="", display_name=display_name)
        for account_id, display_name in backup.user_mapping().items()
    }


def _attachment_resolvers(backup, issue_key):
    """What the importer would find on disk for this issue.

    Only presence matters here - nothing is uploaded - so the ids are blank.
    """
    resolved = {}
    for path in backup.attachments(issue_key):
        content_type = mimetypes.guess_type(path.name)[0] or ""
        resolved[path.name] = ResolvedAttachment(id="", filename=path.name, is_image=content_type.startswith("image/"))
    return resolved


def _documents(issue):
    """Every ADF document an issue carries."""
    bodies = [issue.description] + [comment.body for comment in issue.comments]
    return [body for body in bodies if body]


def report_issue(issue, resolvers):
    result = AdfResult()
    documents = _documents(issue)
    for document in documents:
        adf_to_html(document, resolvers, result)

    return IssueReport(
        key=issue.key,
        summary=issue.summary,
        documents=len(documents),
        nodes=result.nodes,
        marks=result.marks,
        unresolved_users=set(result.unresolved_users),
        unresolved_attachments=set(result.unresolved_attachments),
    )


def report_project(backup, limit=None):
    """Converts every issue in a project and records what degrades.

    This reads the backup only. Nothing is written, no storage is touched, and
    the resolvers answer from the backup itself, so the numbers describe what
    the conversion can do rather than what one particular workspace contains.
    """
    project = backup.project() if backup.exists() else {}
    report = ProjectReport(key=backup.project_key, name=project.get("name", ""))
    users = _user_resolvers(backup)

    for index, issue in enumerate(backup.issues()):
        if limit is not None and index >= limit:
            break

        resolvers = Resolvers(users=users, attachments=_attachment_resolvers(backup, issue.key))
        issue_report = report_issue(issue, resolvers)

        report.issues += 1
        report.documents += issue_report.documents
        if issue_report.is_lossless:
            report.lossless += 1
        else:
            report.worst.append(issue_report)

        report.nodes.update(issue_report.nodes)
        report.marks.update(issue_report.marks)
        report.unresolved_users |= issue_report.unresolved_users
        report.unresolved_attachments |= issue_report.unresolved_attachments

    report.worst.sort(key=lambda item: item.loss, reverse=True)
    return report


def report_backup(root, projects=None, limit=None):
    """Every project in a backup, worst fidelity first - the triage order."""
    keys = list(projects) if projects else project_keys(root)
    reports = [report_project(JiraBackup(root, key), limit=limit) for key in keys]
    reports.sort(key=lambda report: (report.fidelity, -report.issues))
    return reports
