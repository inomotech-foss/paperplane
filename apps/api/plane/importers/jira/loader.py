# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from django.db import transaction

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueComment,
    IssueLabel,
    IssueRelation,
    IssueSequence,
    IssueSubscriber,
    IssueType,
    IssueVote,
    Label,
    Module,
    ModuleIssue,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
    User,
    Workspace,
)
from plane.utils.content_validator import validate_html_content
from plane.utils.issue_type import get_or_create_default_issue_type

from ..confluence.naming import project_name
from ..confluence.resolvers import ResolvedUser, Resolvers
from .adf import AdfResult, Tally, adf_to_html
from .assets import IssueAttachmentUploader
from .backup import issue_number
from .relations import resolve as resolve_link
from .states import GROUP_COLOURS, in_workflow_order, state_for

# Jira's five default priorities onto Plane's five, which are the same ladder.
PRIORITIES = {"highest": "urgent", "high": "high", "medium": "medium", "low": "low", "lowest": "none"}

EPIC_TYPE = "epic"

# Jira's field names onto the ones Plane's activity feed knows how to render.
# Anything absent keeps the Jira name and still records who changed what.
ACTIVITY_FIELDS = {
    "summary": "name",
    "status": "state",
    "assignee": "assignees",
    "duedate": "target_date",
    "issuetype": "type",
    "sprint": "cycles",
    "fix version": "modules",
    "component": "labels",
}

SORT_STEP = 10000


@dataclass
class ImportSummary:
    project_id: str = None
    project_name: str = ""
    project_created: bool = False
    merged: bool = False
    created: int = 0
    updated: int = 0
    comments: int = 0
    states: int = 0
    issue_types: int = 0
    attributed: int = 0
    actor_fallbacks: int = 0
    unmapped_accounts: set = field(default_factory=set)
    attachments: int = 0
    attachments_skipped: bool = False
    missing_attachments: set = field(default_factory=set)
    unsupported_attachments: set = field(default_factory=set)
    labels: int = 0
    modules: int = 0
    cycles: int = 0
    parents: int = 0
    relations: int = 0
    downgraded_relations: int = 0
    activities: int = 0
    subscribers: int = 0
    votes: int = 0
    worklogs: int = 0
    unresolved_parents: set = field(default_factory=set)
    unresolved_links: set = field(default_factory=set)
    chrome: set = field(default_factory=set)
    nodes: Tally = field(default_factory=Tally)
    marks: Tally = field(default_factory=Tally)
    unresolved_users: set = field(default_factory=set)
    unresolved_attachments: set = field(default_factory=set)

    def absorb(self, result):
        self.nodes.update(result.nodes)
        self.marks.update(result.marks)
        self.unresolved_users |= result.unresolved_users
        self.unresolved_attachments |= result.unresolved_attachments


@dataclass
class Index:
    """What the second pass needs, gathered while the issues are written.

    Jira exports issues in no particular order, so a parent, a link target or a
    rank neighbour can appear after the issue that points at it. Nothing
    relational can be written until every issue exists.
    """

    issues: dict = field(default_factory=dict)
    labels: dict = field(default_factory=dict)
    modules: dict = field(default_factory=dict)
    cycles: dict = field(default_factory=dict)
    parents: dict = field(default_factory=dict)
    links: dict = field(default_factory=dict)
    ranks: list = field(default_factory=list)


def _due_date(value):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


class JiraLoader:
    """Loads a backed-up Jira project into a Plane project.

    Writes through the ORM rather than the REST API so original authorship and
    timestamps can be preserved. Idempotent on
    ``(external_source, external_id)``: a re-run updates in place.

    The Jira key survives the import: it becomes ``Project.identifier`` and the
    issue number becomes ``Issue.sequence_id``, so ``DEMO-6`` stays ``DEMO-6``.
    """

    EXTERNAL_SOURCE = "jira"

    def __init__(self, workspace_slug, actor, backup, storage=None):
        self.workspace = Workspace.objects.get(slug=workspace_slug)
        self.actor = actor
        self.backup = backup
        self.storage = storage

    def run(self, dry_run=False):
        summary = ImportSummary()
        statuses, type_names = self._vocabulary()

        with transaction.atomic():
            users = self._user_map()
            project = self._get_or_create_project(summary)
            summary.project_id = str(project.id)
            summary.project_name = project.name

            states = self._upsert_states(project, statuses, summary)
            types, default_type = self._upsert_issue_types(project, type_names, summary)

            # S3 writes are outside the transaction, so a dry run must not make
            # any or it would leave objects behind with no rows pointing at them.
            uploader = (
                None
                if dry_run
                else IssueAttachmentUploader(self.workspace, project, self.backup, self.EXTERNAL_SOURCE, self.storage)
            )
            summary.attachments_skipped = dry_run

            index = Index()
            for issue in self.backup.issues():
                self._load_issue(project, issue, states, types, default_type, users, uploader, index, summary)

            self._resolve_parents(index, summary)
            self._link_relations(index, summary)
            self._rank(index)

            if uploader is not None:
                summary.missing_attachments |= uploader.missing
                summary.unsupported_attachments |= uploader.unsupported

            if dry_run:
                transaction.set_rollback(True)

        return summary

    def _vocabulary(self):
        """The statuses and issue types this project actually uses.

        A separate pass over the backup so states and types exist before the
        first issue needs them, and so nothing but the names has to be held in
        memory for a project with thousands of issues.
        """
        statuses, types = {}, set()
        for issue in self.backup.issues():
            name, group = state_for(issue)
            statuses.setdefault(name, group)
            if issue.issue_type:
                types.add(issue.issue_type)
        return statuses, sorted(types)

    def _user_map(self):
        """Jira accountId -> Plane user, matched on email then display name.

        Anything unmatched falls back to the import actor and is counted. A
        Confluence import of the same site has already created stand-in
        accounts for people with no Plane login, and those match here too.
        """
        accounts = self.backup.users()
        if not accounts:
            return {}

        members = User.objects.filter(
            member_workspace__workspace=self.workspace, member_workspace__is_active=True
        ).distinct()
        by_email, by_display_name = {}, {}
        for member in members:
            if member.email:
                by_email.setdefault(member.email.casefold(), member)
            for key in filter(None, (member.display_name, f"{member.first_name} {member.last_name}".strip())):
                by_display_name.setdefault(key.casefold(), member)

        mapping = {}
        for account_id, account in accounts.items():
            match = by_email.get(account.email.casefold()) if account.email else None
            if match is None and account.display_name:
                match = by_display_name.get(account.display_name.casefold())
            if match is not None:
                mapping[account_id] = match
        return mapping

    def _get_or_create_project(self, summary):
        """The project the Jira key names, created or joined.

        ``Project.identifier`` is the Jira key, so a Confluence space already
        imported under that key is the same project: the wiki and the work
        items belong together and the key has to keep pointing at one project.
        An existing project keeps every setting an admin chose, visibility and
        network included, and only gains the two tabs the import fills: it now
        holds work items and the issue types they are typed with, so both have
        to be reachable.
        """
        key = self.backup.project_key
        project = Project.objects.filter(workspace=self.workspace, identifier=key).first()
        if project is not None:
            summary.merged = project.external_source != self.EXTERNAL_SOURCE
            if not (project.issue_view and project.is_issue_type_enabled):
                project.issue_view = True
                project.is_issue_type_enabled = True
                project.save(disable_auto_set_user=True)
            return project

        details = self.backup.project()
        taken_names = set(Project.objects.filter(workspace=self.workspace).values_list("name", flat=True))
        project = Project.objects.create(
            workspace=self.workspace,
            name=project_name(details.get("name"), key, prefix="", taken=taken_names),
            identifier=key,
            description=f"Imported from Jira project {key}",
            network=0,
            issue_view=True,
            is_issue_type_enabled=True,
            external_source=self.EXTERNAL_SOURCE,
            external_id=str(details.get("id") or key),
        )
        ProjectMember.objects.get_or_create(project=project, member=self.actor, defaults={"role": 20})
        summary.project_created = True
        return project

    def _upsert_states(self, project, statuses, summary):
        """One Plane state per Jira status, created in workflow order.

        Matched by name rather than by external id, so a project that already
        has states, from Plane's defaults or from a Confluence import, reuses
        them instead of colliding with the unique name.
        """
        existing = {
            state.name.casefold(): state
            for state in State.all_state_objects.filter(project=project, deleted_at__isnull=True)
        }
        has_default = any(state.default for state in existing.values())
        states = {}

        for name, group in in_workflow_order(statuses):
            state = existing.get(name.casefold())
            if state is None:
                state = State.objects.create(
                    workspace=self.workspace,
                    project=project,
                    name=name,
                    group=group,
                    color=GROUP_COLOURS[group],
                    default=not has_default,
                    external_source=self.EXTERNAL_SOURCE,
                    external_id=name,
                )
                has_default = True
                existing[name.casefold()] = state
                summary.states += 1
            states[name] = state

        return states

    def _upsert_issue_types(self, project, names, summary):
        """One workspace issue type per Jira issue type, linked to the project.

        Types are workspace-wide in Plane, so a name shared across Jira
        projects becomes one type rather than a copy per project.
        """
        default = get_or_create_default_issue_type(project)
        types = {}

        for name in names:
            issue_type = IssueType.objects.filter(workspace=self.workspace, name=name).first()
            if issue_type is None:
                issue_type = IssueType.objects.create(
                    workspace=self.workspace,
                    name=name,
                    is_epic=name.strip().casefold() == EPIC_TYPE,
                    is_active=True,
                    external_source=self.EXTERNAL_SOURCE,
                    external_id=name,
                )
                summary.issue_types += 1
            ProjectIssueType.objects.get_or_create(
                project=project,
                issue_type=issue_type,
                defaults={"workspace": self.workspace, "is_default": issue_type.id == default.id},
            )
            types[name] = issue_type

        return types, default

    def _load_issue(self, project, jira_issue, states, types, default_type, users, uploader, index, summary):
        author = self._author(jira_issue, users, summary)
        name, _ = state_for(jira_issue)
        issue_type = types.get(jira_issue.issue_type, default_type)
        record = self._upsert_issue(project, jira_issue, states[name], issue_type, author, summary)

        self._assign(record, jira_issue, users, summary)
        attachments = {} if uploader is None else uploader.upload_for_issue(jira_issue, record)
        summary.attachments += len(attachments)

        resolvers = self._resolvers(users, attachments)
        self._write_body(record, jira_issue, resolvers, summary)
        self._upsert_comments(record, jira_issue, resolvers, users, summary)
        self._apply_labels(record, jira_issue, index, summary)
        self._apply_modules(record, jira_issue, index, summary)
        self._apply_cycles(record, jira_issue, index, summary)
        self._apply_interest(record, jira_issue, users, summary)
        self._apply_changelog(record, jira_issue, users, summary)
        self._align(record, jira_issue)
        self._index(record, jira_issue, index, summary)

    def _index(self, record, jira_issue, index, summary):
        """Notes what can only be written once the whole file has been read.

        Jira states a parent three ways and they do not always agree: the
        `parent` field, an Epic Link custom field, and the parent's own subtask
        list. The issue's own fields are the more reliable pair, so a subtask
        listing only fills a gap.
        """
        index.issues[jira_issue.key] = record
        index.ranks.append((jira_issue.rank, jira_issue.key))

        parent_key = jira_issue.parent_key or jira_issue.epic_key
        if parent_key:
            index.parents[jira_issue.key] = parent_key
        for child_key in jira_issue.subtask_keys:
            index.parents.setdefault(child_key, jira_issue.key)

        for link in jira_issue.links:
            first, second, relation, exact = resolve_link(jira_issue.key, link)
            index.links.setdefault((first, second), (relation, exact))

        summary.worklogs += jira_issue.worklogs
        summary.chrome |= set(jira_issue.chrome)

    def _author(self, jira_issue, users, summary):
        """Who filed the issue in Jira, or the actor when the account is unknown.

        Jira records both a creator and a reporter and they usually agree; the
        reporter is who the ticket is about, so it stands in when the creator
        is missing.
        """
        account_id = jira_issue.creator_id or jira_issue.reporter_id
        author = users.get(account_id) if account_id else None
        if author is not None:
            summary.attributed += 1
            return author

        if account_id:
            summary.unmapped_accounts.add(account_id)
        summary.actor_fallbacks += 1
        return self.actor

    def _upsert_issue(self, project, jira_issue, state, issue_type, author, summary):
        record = Issue.objects.filter(
            project=project,
            external_source=self.EXTERNAL_SOURCE,
            external_id=jira_issue.key,
        ).first()

        if record is None:
            record = Issue(
                project=project,
                workspace=self.workspace,
                external_source=self.EXTERNAL_SOURCE,
                external_id=jira_issue.key,
            )
            summary.created += 1
        else:
            summary.updated += 1

        record.name = jira_issue.summary[:255]
        record.state = state
        record.type = issue_type
        record.priority = PRIORITIES.get(jira_issue.priority.strip().casefold(), "none")
        record.created_by = author
        record.save(disable_auto_set_user=True)
        return record

    def _assign(self, record, jira_issue, users, summary):
        """Jira carries at most one assignee, so the set is replaced.

        An unmapped assignee leaves the issue unassigned rather than handing
        someone else's work to whoever ran the import.
        """
        assignee = users.get(jira_issue.assignee_id) if jira_issue.assignee_id else None
        if assignee is None:
            if jira_issue.assignee_id:
                summary.unmapped_accounts.add(jira_issue.assignee_id)
            IssueAssignee.objects.filter(issue=record).delete()
            return

        IssueAssignee.objects.filter(issue=record).exclude(assignee=assignee).delete()
        IssueAssignee.objects.get_or_create(
            issue=record, assignee=assignee, defaults={"project": record.project, "workspace": self.workspace}
        )

    def _resolvers(self, users, attachments):
        return Resolvers(
            users={
                account_id: ResolvedUser(id=str(user.id), display_name=user.display_name)
                for account_id, user in users.items()
            },
            attachments=attachments,
        )

    def _write_body(self, record, jira_issue, resolvers, summary):
        result = AdfResult()
        adf_to_html(jira_issue.description, resolvers, result)
        summary.absorb(result)

        record.description_html = self._clean(result.html, jira_issue.key)
        record.save(disable_auto_set_user=True)

    def _upsert_comments(self, record, jira_issue, resolvers, users, summary):
        for comment in jira_issue.comments:
            author = users.get(comment.author_id) if comment.author_id else None
            if author is None and comment.author_id:
                summary.unmapped_accounts.add(comment.author_id)

            result = AdfResult()
            adf_to_html(comment.body, resolvers, result)
            summary.absorb(result)

            row = IssueComment.objects.filter(
                issue=record,
                external_source=self.EXTERNAL_SOURCE,
                external_id=comment.id,
            ).first()
            if row is None:
                row = IssueComment(
                    issue=record,
                    project=record.project,
                    workspace=self.workspace,
                    external_source=self.EXTERNAL_SOURCE,
                    external_id=comment.id,
                )

            row.comment_html = self._clean(result.html, f"{jira_issue.key} comment {comment.id}")
            row.actor = author or self.actor
            row.created_by = author or self.actor
            row.save(disable_auto_set_user=True)

            if comment.created_at:
                IssueComment.objects.filter(pk=row.pk).update(
                    created_at=comment.created_at, updated_at=comment.created_at
                )
            summary.comments += 1

    def _apply_labels(self, record, jira_issue, index, summary):
        """Jira labels and components both become Plane labels.

        Components are a separate taxonomy in Jira with no Plane counterpart,
        and they read as labels wherever they are used, so the two collapse.
        """
        for name in dict.fromkeys(jira_issue.labels + jira_issue.components):
            label = index.labels.get(name)
            if label is None:
                label, created = Label.objects.get_or_create(
                    project=record.project,
                    name=name,
                    defaults={
                        "workspace": self.workspace,
                        "external_source": self.EXTERNAL_SOURCE,
                        "external_id": name,
                    },
                )
                index.labels[name] = label
                summary.labels += int(created)
            IssueLabel.objects.get_or_create(
                issue=record, label=label, defaults={"project": record.project, "workspace": self.workspace}
            )

    def _apply_modules(self, record, jira_issue, index, summary):
        """A fix version is the release an issue ships in, which is a module."""
        for name in jira_issue.fix_versions:
            module = index.modules.get(name)
            if module is None:
                module, created = Module.objects.get_or_create(
                    project=record.project,
                    name=name,
                    defaults={
                        "workspace": self.workspace,
                        "external_source": self.EXTERNAL_SOURCE,
                        "external_id": name,
                    },
                )
                index.modules[name] = module
                summary.modules += int(created)
            ModuleIssue.objects.get_or_create(
                issue=record, module=module, defaults={"project": record.project, "workspace": self.workspace}
            )

    def _apply_cycles(self, record, jira_issue, index, summary):
        """Sprints, read off the issues rather than out of `sprints.json`.

        The board endpoints failed during the backup and the sprint file holds
        one sprint, so the issues are the only complete record. Plane puts an
        issue in one cycle while Jira lists every sprint it passed through, so
        the cycles are all created and the issue joins the last one.
        """
        for sprint in jira_issue.sprints:
            if sprint.id not in index.cycles:
                index.cycles[sprint.id] = self._cycle(record.project, sprint, summary)

        if not jira_issue.sprints:
            return
        cycle = index.cycles[jira_issue.sprints[-1].id]
        CycleIssue.objects.get_or_create(
            issue=record, cycle=cycle, defaults={"project": record.project, "workspace": self.workspace}
        )

    def _cycle(self, project, sprint, summary):
        cycle = Cycle.objects.filter(
            project=project, external_source=self.EXTERNAL_SOURCE, external_id=sprint.id
        ).first()
        if cycle is not None:
            return cycle

        cycle = Cycle.objects.create(
            project=project,
            workspace=self.workspace,
            name=sprint.name[:255],
            description=sprint.goal,
            owned_by=self.actor,
            start_date=sprint.start_at,
            end_date=sprint.completed_at or sprint.end_at,
            external_source=self.EXTERNAL_SOURCE,
            external_id=sprint.id,
        )
        summary.cycles += 1
        return cycle

    def _apply_interest(self, record, jira_issue, users, summary):
        """Watchers become subscribers and voters become upvotes."""
        for account_id in jira_issue.watcher_ids:
            user = users.get(account_id)
            if user is None:
                summary.unmapped_accounts.add(account_id)
                continue
            _, created = IssueSubscriber.objects.get_or_create(
                issue=record, subscriber=user, defaults={"project": record.project, "workspace": self.workspace}
            )
            summary.subscribers += int(created)

        for account_id in jira_issue.voter_ids:
            user = users.get(account_id)
            if user is None:
                summary.unmapped_accounts.add(account_id)
                continue
            _, created = IssueVote.objects.get_or_create(
                issue=record,
                actor=user,
                defaults={"vote": 1, "project": record.project, "workspace": self.workspace},
            )
            summary.votes += int(created)

    def _apply_changelog(self, record, jira_issue, users, summary):
        """Jira's audit trail, kept whole.

        The same ISO 9001 and 14001 obligation that made authorship worth
        preserving applies to who changed what and when, so every entry keeps
        its original actor and timestamp. There is no external id to be
        idempotent on, so a re-run matches on the entry itself.
        """
        if not jira_issue.changelog:
            return

        seen = set(
            IssueActivity.objects.filter(issue=record).values_list("field", "old_value", "new_value", "created_at")
        )
        rows, stamped = [], defaultdict(list)

        for change in jira_issue.changelog:
            actor = users.get(change.author_id) if change.author_id else None
            if actor is None and change.author_id:
                summary.unmapped_accounts.add(change.author_id)

            name = ACTIVITY_FIELDS.get(change.field_name.strip().casefold(), change.field_name)[:255]
            if (name, change.old_value, change.new_value, change.created_at) in seen:
                continue

            row = IssueActivity(
                issue=record,
                project=record.project,
                workspace=self.workspace,
                actor=actor or self.actor,
                created_by=actor or self.actor,
                verb="updated",
                field=name,
                old_value=change.old_value,
                new_value=change.new_value,
                comment=f"updated the {name}",
                epoch=int(change.created_at.timestamp()) if change.created_at else None,
            )
            rows.append(row)
            if change.created_at:
                stamped[change.created_at].append(row.id)

        IssueActivity.objects.bulk_create(rows, batch_size=500)
        for moment, ids in stamped.items():
            IssueActivity.objects.filter(id__in=ids).update(created_at=moment, updated_at=moment)
        summary.activities += len(rows)

    def _resolve_parents(self, index, summary):
        """Parenting, once every issue exists.

        A child routinely appears in the file before its parent, so a single
        pass would drop the link. Written as an UPDATE because `Issue.save()`
        would take the sequence lock and restamp the audit dates again.
        """
        for child_key, parent_key in index.parents.items():
            child = index.issues.get(child_key)
            if child is None:
                continue
            parent = self._lookup(parent_key, index)
            if parent is None:
                summary.unresolved_parents.add(parent_key)
                continue
            if parent.id == child.id or child.parent_id == parent.id:
                continue
            Issue.objects.filter(pk=child.pk).update(parent=parent)
            child.parent_id = parent.id
            summary.parents += 1

    def _link_relations(self, index, summary):
        for (first, second), (relation, exact) in index.links.items():
            issue = self._lookup(first, index)
            related = self._lookup(second, index)
            if issue is None or related is None:
                summary.unresolved_links.add(f"{first} {second}")
                continue

            _, created = IssueRelation.objects.get_or_create(
                issue=issue,
                related_issue=related,
                defaults={
                    "relation_type": relation,
                    "project": issue.project,
                    "workspace": self.workspace,
                },
            )
            summary.relations += int(created)
            if not exact:
                summary.downgraded_relations += 1

    def _lookup(self, key, index):
        """An issue by Jira key, including one an earlier project brought in."""
        if key in index.issues:
            return index.issues[key]
        found = Issue.objects.filter(
            workspace=self.workspace, external_source=self.EXTERNAL_SOURCE, external_id=key
        ).first()
        index.issues[key] = found
        return found

    def _rank(self, index):
        """Jira's LexoRank renumbered into Plane's sort order.

        Jira keeps backlog position in a string that sorts lexicographically and
        Plane keeps a float, so the strings are sorted and the positions handed
        out again. An issue with no rank sorts after the ranked ones in the
        order it was read.
        """
        ordered = sorted(enumerate(index.ranks), key=lambda item: (not item[1][0], item[1][0], item[0]))
        records = []
        for position, (_, (_, key)) in enumerate(ordered):
            record = index.issues.get(key)
            if record is None:
                continue
            record.sort_order = float((position + 1) * SORT_STEP)
            records.append(record)
        Issue.objects.bulk_update(records, ["sort_order"], batch_size=500)

    def _align(self, record, jira_issue):
        """Jira's own numbering and dates, written after the fact.

        ``Issue.save()`` picks a ``sequence_id`` of its own under a per-project
        advisory lock, stamps ``completed_at`` from the state group, and
        ``auto_now``/``auto_now_add`` overwrite the audit dates, so all of it
        has to go in as an UPDATE. Numbering gaps are fine: only the largest
        sequence decides what the next user-created issue gets.
        """
        number = issue_number(jira_issue.key)
        fields = {
            "created_at": jira_issue.created_at or record.created_at,
            "updated_at": jira_issue.updated_at or record.updated_at,
            "completed_at": jira_issue.resolved_at,
            "target_date": _due_date(jira_issue.due_date),
        }
        if number is not None:
            fields["sequence_id"] = number
            IssueSequence.objects.filter(issue=record).update(sequence=number)
        Issue.objects.filter(pk=record.pk).update(**fields)

    @staticmethod
    def _clean(html, label):
        is_valid, error, clean = validate_html_content(html)
        if not is_valid:
            raise ValueError(f"{label} produced invalid HTML: {error}")
        return clean or "<p></p>"
