# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from plane.db.models import (
    Issue,
    Label,
    Page,
    PageIndexEntry,
    PageLabel,
    PageVersion,
    Project,
    ProjectMember,
    ProjectPage,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.db.models.state import DEFAULT_STATES
from plane.utils.content_validator import validate_html_content
from plane.utils.issue_type import get_or_create_default_issue_type

from .assets import AttachmentUploader
from .backup import ConfluenceBackup, order_parents_first, sibling_sort_orders, space_keys
from .jira import derive_base_urls
from .naming import project_identifier, project_name
from .resolvers import ConversionResult, ResolvedJiraIssue, ResolvedPage, ResolvedUser, Resolvers
from .storage import storage_to_html
from .text import same_text, text_diff

_ACCOUNT_ID = re.compile(r'ri:account-id="([^"]+)"')

# What the Jira loader stamps on every work item it creates.
_JIRA_EXTERNAL_SOURCE = "jira"

# The loader writes the backup's own timestamp back onto a page, so anything
# later than that is an edit made in Plane. The slack absorbs rounding.
_EDIT_SLACK = timedelta(seconds=1)

PLACEHOLDER_HTML = (
    "<p>This page stands in for a Confluence folder or database the export did not include. "
    "Rename it and move it where it belongs.</p>"
)


@dataclass(frozen=True)
class Change:
    """One structural change the run makes (or, on a dry run, would make)."""

    kind: str
    title: str
    detail: str = ""


@dataclass
class ImportSummary:
    project_id: str = None
    project_name: str = ""
    created: int = 0
    updated: int = 0
    roots: int = 0
    containers: int = 0
    archived: int = 0
    locally_edited: int = 0
    kept: int = 0
    skipped_deleted: int = 0
    # Set when the whole space was left alone, with the reason.
    skipped: str = ""
    reordered: int = 0
    owner_granted: bool = False
    changes: list = field(default_factory=list)
    attributed: int = 0
    unmapped_authors: set = field(default_factory=set)
    placeholders: int = 0
    unsupported_macros: Counter = field(default_factory=Counter)
    unresolved_pages: set = field(default_factory=set)
    unresolved_wiki_urls: set = field(default_factory=set)
    unresolved_attachments: set = field(default_factory=set)
    unsupported_attachments: set = field(default_factory=set)
    attachments: int = 0
    attachments_skipped: bool = False
    labels: int = 0
    index_entries: int = 0
    dropped_layouts: int = 0
    downgraded: Counter = field(default_factory=Counter)
    dropped_chrome: Counter = field(default_factory=Counter)

    def absorb(self, result):
        self.unsupported_macros.update(result.unsupported_macros)
        self.unresolved_pages |= result.unresolved_pages
        self.unresolved_wiki_urls |= result.unresolved_wiki_urls
        self.unresolved_attachments |= result.unresolved_attachments
        self.dropped_layouts += result.dropped_layouts
        self.downgraded.update(result.downgraded)
        self.dropped_chrome.update(result.dropped_chrome)


class ConfluenceLoader:
    """Loads a backed-up Confluence space into a Plane project.

    Writes through the ORM rather than the REST API so original authorship and
    timestamps can be preserved. Idempotent on
    ``(external_source, external_id)``: a re-run updates in place.
    """

    EXTERNAL_SOURCE = "confluence"

    def __init__(
        self,
        workspace_slug,
        actor,
        backup,
        page_url_template="/{slug}/projects/{project}/pages/{page}/",
        storage=None,
        jira_base_urls=None,
    ):
        self.workspace = Workspace.objects.get(slug=workspace_slug)
        self.actor = actor
        self.backup = backup
        self.page_url_template = page_url_template
        self.storage = storage
        self.jira_base_urls = jira_base_urls if jira_base_urls is not None else settings.CONFLUENCE_JIRA_BASE_URLS
        self.site = backup.site()
        self.jira_project_keys = backup.jira_project_keys()

    def run(self, dry_run=False, structure_only=False, take=(), diff_dir=None):
        """Load the space.

        A page whose readable text was changed in Plane keeps its body unless
        its Confluence id is in ``take``; with ``diff_dir`` the plan writes
        each such difference to a file. ``structure_only`` repairs parents,
        order, archive flags and placeholders but rewrites no existing body.
        """
        summary = ImportSummary()
        space = self.backup.space()
        if self._project_deleted(space):
            summary.skipped = "project was deleted in Plane"
            return summary
        pages = order_parents_first(self.backup.pages())
        orders = sibling_sort_orders(pages)

        with transaction.atomic():
            users = self._user_map(pages, summary, extra={self.backup.space_owner_id()})
            project = self._get_or_create_project(space, users, summary)
            summary.project_id = str(project.id)
            summary.project_name = project.name

            # Two passes: Confluence links pages by title, so no link can be
            # rewritten until every page in the space has an id.
            records, created, touched = self._upsert_pages(project, pages, orders, users, summary)
            self._write_bodies(
                project,
                pages,
                records,
                users,
                summary,
                dry_run,
                only=created if structure_only else None,
                created=created,
                touched=touched,
                take=set(take),
                diff_dir=diff_dir,
            )

            if dry_run:
                transaction.set_rollback(True)

        return summary

    def _referenced_accounts(self, pages):
        """Accounts this space actually names, as authors or in a mention.

        Bounds placeholder creation: the backup's account map spans every space
        and most of it is irrelevant to any one of them.
        """
        found = {page.author_id for page in pages if page.author_id}
        for page in pages:
            found.update(_ACCOUNT_ID.findall(page.body))
        return found

    def _user_map(self, pages, summary=None, extra=()):
        """Confluence accountId -> Plane user, matched on email then display name.

        Anything still unmatched gets a placeholder account, so a page keeps its
        original author and a mention keeps its name rather than collapsing onto
        whoever ran the import. ``extra`` names accounts to map besides the
        ones the pages reference, such as the space owner.
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

        referenced = self._referenced_accounts(pages) | {account for account in extra if account}
        mapping = {}
        for account_id, account in accounts.items():
            match = by_email.get(account.email.casefold()) if account.email else None
            if match is None and account.display_name:
                match = by_display_name.get(account.display_name.casefold())
            if match is None and account_id not in referenced:
                continue
            mapping[account_id] = match or self._placeholder_user(account, summary)
        return mapping

    def _placeholder_user(self, account, summary=None):
        """A stand-in for a Confluence account with no Plane user.

        The account is deactivated so it cannot sign in, but its membership is
        active because that is what the editor reads to render a mention.
        """
        email = (account.email or f"{account.account_id}@confluence.invalid").casefold().strip()
        name = account.display_name or email.split("@")[0]
        first, _, last = name.partition(" ")

        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create(
                username=f"confluence-{account.account_id}"[:128],
                email=email,
                display_name=name,
                first_name=first,
                last_name=last,
                is_active=False,
                is_password_autoset=True,
            )
            if summary is not None:
                summary.placeholders += 1

        WorkspaceMember.objects.get_or_create(workspace=self.workspace, member=user, defaults={"role": 5})
        return user

    def _project_deleted(self, space):
        """True if this space's project was deleted in Plane and never recreated.

        A deletion is a decision; a re-run must not undo it.
        """
        external_id = str(space.get("id") or space.get("key") or self.backup.space_key)
        projects = Project.all_objects.filter(
            workspace=self.workspace, external_source=self.EXTERNAL_SOURCE, external_id=external_id
        )
        return (
            projects.filter(deleted_at__isnull=False).exists() and not projects.filter(deleted_at__isnull=True).exists()
        )

    def _get_or_create_project(self, space, users=None, summary=None):
        """The project for this space, created on first sight.

        Everything set here is set on create only: a re-import must never
        revert an admin's choice. A space that was archived in Confluence
        starts archived, and the space owner becomes a project admin so a
        personal space reaches the one person it belongs to.
        """
        identifier_key = space.get("key") or self.backup.space_key
        existing = Project.objects.filter(
            workspace=self.workspace,
            external_source=self.EXTERNAL_SOURCE,
            external_id=str(space.get("id") or identifier_key),
        ).first()
        if existing:
            return existing

        existing_projects = Project.objects.filter(workspace=self.workspace)
        taken = set(existing_projects.values_list("identifier", flat=True))
        taken_names = set(existing_projects.values_list("name", flat=True))
        project = Project.objects.create(
            workspace=self.workspace,
            name=project_name(space.get("name"), identifier_key, taken=taken_names),
            identifier=project_identifier(identifier_key, taken),
            description=f"Imported from Confluence space {identifier_key}",
            external_source=self.EXTERNAL_SOURCE,
            external_id=str(space.get("id") or identifier_key),
            # The backup carries no permission data, so a fresh import must default
            # to private and wiki-only rather than public with work items exposed.
            # Only set on create: a re-import must never revert an admin's choice.
            network=0,
            issue_view=False,
            archived_at=timezone.now() if self.backup.space_status() == "archived" else None,
        )
        ProjectMember.objects.get_or_create(project=project, member=self.actor, defaults={"role": 20})
        owner = (users or {}).get(self.backup.space_owner_id())
        if owner is not None and owner.is_active and owner != self.actor:
            ProjectMember.objects.get_or_create(project=project, member=owner, defaults={"role": 20})
            if summary is not None:
                summary.owner_granted = True
        State.objects.bulk_create(
            [
                State(
                    name=state["name"],
                    color=state["color"],
                    project=project,
                    sequence=state["sequence"],
                    workspace=self.workspace,
                    group=state["group"],
                    default=state.get("default", False),
                )
                for state in DEFAULT_STATES
            ]
        )
        get_or_create_default_issue_type(project)
        return project

    def _upsert_labels(self, pages):
        """Confluence labels become workspace-level labels.

        ``Label`` allows a null project and enforces name uniqueness in that
        case, so one label spans every space that used it, which is what a
        cross-space label query needs. The uniqueness constraint also makes a
        re-run idempotent without a lookup table.
        """
        names = {name for page in pages for name in page.labels}
        if not names:
            return {}

        labels = {
            label.name: label
            for label in Label.objects.filter(workspace=self.workspace, project__isnull=True, name__in=names)
        }
        for name in sorted(names - set(labels)):
            labels[name] = Label.objects.create(
                workspace=self.workspace,
                project=None,
                name=name,
                external_source=self.EXTERNAL_SOURCE,
                external_id=name,
            )
        return labels

    def _link_labels(self, record, names, labels, summary):
        wanted = {labels[name].id for name in names if name in labels}
        if not wanted:
            return

        linked = set(PageLabel.objects.filter(page=record).values_list("label_id", flat=True))
        for label_id in wanted - linked:
            PageLabel.objects.create(page=record, label_id=label_id, workspace=self.workspace)
            summary.labels += 1

    @staticmethod
    def _parent_name(parent):
        if parent is None:
            return "root"
        if isinstance(parent, Page):
            return parent.name
        return Page.objects.filter(pk=parent).values_list("name", flat=True).first() or "root"

    @staticmethod
    def _locally_edited(record, page):
        return bool(page.updated_at and record.updated_at and record.updated_at > page.updated_at + _EDIT_SLACK)

    def _upsert_pages(self, project, pages, orders, users, summary):
        """Create or refresh every page row.

        Structure (parent, order, archive flag) always follows the backup.
        Title, owner and timestamps are left alone on a page someone touched
        in Plane since the import; whether its body is kept is decided by
        content in the body pass. A page deleted in Plane stays deleted.
        Returns the records plus the ids created and touched.
        """
        labels = self._upsert_labels(pages)
        records, created, touched = {}, set(), set()
        for page in pages:
            owner = users.get(page.author_id)
            if owner is None and page.author_id and not page.placeholder:
                summary.unmapped_authors.add(page.author_id)

            rows = Page.all_objects.filter(
                workspace=self.workspace,
                external_source=self.EXTERNAL_SOURCE,
                external_id=page.id,
            )
            record = rows.filter(deleted_at__isnull=True).first()
            local_updated_at = None

            if record is None and rows.exists():
                summary.skipped_deleted += 1
                summary.changes.append(Change("skip", page.title, "deleted in Plane"))
                continue

            if record is None:
                record = Page(
                    workspace=self.workspace,
                    name=page.title,
                    owned_by=owner or self.actor,
                    access=Page.PUBLIC_ACCESS,
                    external_source=self.EXTERNAL_SOURCE,
                    external_id=page.id,
                )
                created.add(page.id)
                summary.created += 1
                summary.changes.append(Change("create", page.title, "placeholder" if page.placeholder else ""))
            elif self._locally_edited(record, page):
                local_updated_at = record.updated_at
                touched.add(page.id)
                summary.locally_edited += 1
                summary.updated += 1
            else:
                if record.name != page.title:
                    summary.changes.append(Change("rename", record.name, page.title))
                record.name = page.title
                record.owned_by = owner or self.actor
                summary.updated += 1

            if owner is not None:
                summary.attributed += 1
            if page.placeholder:
                summary.containers += 1

            parent = records.get(page.parent_id)
            if parent is None:
                summary.roots += 1

            sort_order = orders.get(page.id, record.sort_order)
            if page.id not in created:
                if record.parent_id != (parent.pk if parent else None):
                    summary.changes.append(
                        Change(
                            "move", page.title, f"{self._parent_name(record.parent_id)} -> {self._parent_name(parent)}"
                        )
                    )
                if record.sort_order != sort_order:
                    summary.reordered += 1
            record.parent = parent
            record.sort_order = sort_order
            # Archived in Confluence means archived here; never the reverse,
            # since an admin may have archived or restored a page by hand.
            if page.archived and record.archived_at is None:
                record.archived_at = (page.updated_at or timezone.now()).date()
                summary.archived += 1
                summary.changes.append(Change("archive", page.title))
            record.save(disable_auto_set_user=True)
            ProjectPage.objects.get_or_create(project=project, page=record, workspace=self.workspace)
            self._link_labels(record, page.labels, labels, summary)

            # auto_now_add / auto_now win on save(), so the real Confluence
            # timestamps have to be written with an UPDATE. An edited page keeps
            # its own updated_at, which is what marks it as edited next time.
            Page.objects.filter(pk=record.pk).update(
                created_at=page.created_at, updated_at=local_updated_at or page.updated_at
            )
            records[page.id] = record

        return records, created, touched

    def _space_keys_by_project(self):
        """Which Confluence space each imported project came from.

        The project stores the space id, so the backup's own space.json files
        are what turn it back into the key a link names.
        """
        keys_by_space_id = {}
        for key in space_keys(self.backup.root):
            space = ConfluenceBackup(self.backup.root, key).space()
            keys_by_space_id[str(space.get("id") or key)] = key

        return {
            project.id: keys_by_space_id[project.external_id]
            for project in Project.objects.filter(workspace=self.workspace, external_source=self.EXTERNAL_SOURCE)
            if project.external_id in keys_by_space_id
        }

    def _resolved(self, page_id, project_id, title):
        return ResolvedPage(
            id=str(page_id),
            url=self.page_url_template.format(slug=self.workspace.slug, project=project_id, page=page_id),
            title=title,
        )

    def _page_map(self, project, pages, records):
        """Confluence page title -> the Plane page it became.

        Titles cross spaces freely, so the map covers every Confluence page
        already in the workspace, keyed by title and by the space a link names.
        A space imported later fills in the links that pointed at it on the next
        run of the spaces that reference it.
        """
        space_keys_by_project = self._space_keys_by_project()
        page_map = {}

        for link in (
            ProjectPage.objects.filter(workspace=self.workspace, page__external_source=self.EXTERNAL_SOURCE)
            .exclude(project=project)
            .select_related("page")
        ):
            resolved = self._resolved(link.page.id, link.project_id, link.page.name)
            page_map[link.page.name] = resolved
            if link.page.external_id:
                page_map[("id", link.page.external_id)] = resolved
            space_key = space_keys_by_project.get(link.project_id)
            if space_key:
                page_map[(space_key, link.page.name)] = resolved

        for page in pages:
            record = records.get(page.id)
            if record is None:
                continue
            resolved = self._resolved(record.id, project.id, page.title)
            # This space wins a title it shares with another: a link that names
            # no space means the page next to it.
            page_map[page.title] = resolved
            page_map[(self.backup.space_key, page.title)] = resolved
            page_map[("id", str(page.id))] = resolved

        return page_map

    def _jira_issue_map(self):
        """Jira (project identifier, sequence id) -> the work item it became.

        ``Project.identifier`` is the Jira project key and ``Issue.sequence_id``
        is the number in a key such as ``DEMO-12``, so this is the whole
        lookup: no mapping table survives from the Jira import to consult.
        Scoped to ``external_source="jira"`` so a work item that merely shares
        a project identifier and sequence id, but that Jira never touched, is
        never matched.
        """
        return {
            (issue.project.identifier, issue.sequence_id): ResolvedJiraIssue(
                id=str(issue.id), project_id=str(issue.project_id), workspace_id=str(self.workspace.id)
            )
            for issue in Issue.objects.filter(
                workspace=self.workspace, external_source=_JIRA_EXTERNAL_SOURCE
            ).select_related("project")
        }

    def _write_bodies(
        self,
        project,
        pages,
        records,
        users,
        summary,
        dry_run,
        only=None,
        created=frozenset(),
        touched=frozenset(),
        take=frozenset(),
        diff_dir=None,
    ):
        """Convert and store every body in ``only`` (all pages by default).

        A page saved in Plane since the import (``touched``, judged by the
        timestamp before this run wrote anything) whose readable text differs
        from the conversion is kept, reported, and on request diffed to a
        file, unless ``take`` names it. Opening a page saves it, so the text
        decides; the timestamp only narrows which pages are compared.
        """
        user_map = {
            account_id: ResolvedUser(id=str(user.id), display_name=user.display_name)
            for account_id, user in users.items()
        }
        page_map = self._page_map(project, pages, records)
        # The setting wins: only the operator can name a server the backup
        # holds no evidence about.
        jira_base_urls = derive_base_urls(pages, self.site, self.jira_project_keys) | self.jira_base_urls
        jira_issues = self._jira_issue_map()

        # S3 writes are outside the transaction, so a dry run must not make any
        # or it would leave objects behind with no rows pointing at them.
        uploader = (
            None
            if dry_run
            else AttachmentUploader(self.workspace, project, self.backup, self.EXTERNAL_SOURCE, self.storage)
        )
        summary.attachments_skipped = dry_run

        for page in pages:
            record = records.get(page.id)
            if record is None or (only is not None and page.id not in only):
                continue
            if page.placeholder:
                Page.objects.filter(pk=record.pk).update(description_html=PLACEHOLDER_HTML, updated_at=page.updated_at)
                self._seed_version(record, page, PLACEHOLDER_HTML)
                continue

            attachments = {} if uploader is None else uploader.upload_for_page(page.id, record, page.body)
            summary.attachments += len(attachments)

            # Attachments are per page, so the resolver set is rebuilt each time
            # while the space-wide user and page maps are shared.
            resolvers = Resolvers(
                users=user_map,
                attachments=attachments,
                pages=page_map,
                jira_base_urls=jira_base_urls,
                jira_issues=jira_issues,
            )
            result = storage_to_html(page.body, resolvers, ConversionResult(html=""))
            summary.absorb(result)

            is_valid, error, clean = validate_html_content(result.html)
            if not is_valid:
                raise ValueError(f"Page {page.id} ({page.title!r}) produced invalid HTML: {error}")

            description_html = clean or "<p></p>"
            if page.id in touched and page.id not in take and not same_text(record.description_html, description_html):
                diff, added, removed = text_diff(description_html, record.description_html, "backup", "plane")
                summary.kept += 1
                summary.changes.append(Change("keep", page.title, f"+{added} -{removed} lines, id {page.id}"))
                if diff_dir:
                    path = Path(diff_dir) / f"{self.backup.space_key}-{page.id}.diff"
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(f"{page.title}\nplane page {record.pk}\n\n{diff}\n")
                continue
            # The editor prefers the binary document over the HTML once a page
            # has been opened, so a rewritten body only shows if the binary is
            # dropped and rebuilt from the HTML. Pages edited in Plane never
            # reach this point.
            Page.objects.filter(pk=record.pk).update(
                description_html=description_html,
                description_binary=None,
                description_json={},
                updated_at=page.updated_at,
            )
            self._seed_version(record, page, description_html)
            self._write_index(record, result, users, summary)

        if uploader is not None:
            summary.unsupported_attachments |= uploader.unsupported

    def _seed_version(self, record, page, description_html):
        """Give an imported page the one version the backup can support.

        Only for a page with no versions at all: one that has them carries
        its Confluence history, which is never rewritten.
        """
        if PageVersion.objects.filter(page_id=record.pk).exists():
            return

        PageVersion.objects.create(
            workspace=self.workspace,
            page_id=record.pk,
            owned_by_id=record.owned_by_id,
            last_saved_at=page.updated_at,
            description_html=description_html,
            description_json=record.description_json,
            description_binary=record.description_binary,
            sub_pages_data={},
        )

    def _write_index(self, record, result, users, summary):
        """Replace the page's queryable facts with the ones just extracted.

        Replaced rather than merged because a re-import is the whole page
        again: a property row deleted upstream has to disappear here too, and
        the entries carry no stable identity of their own to match on.
        """
        PageIndexEntry.objects.filter(page_id=record.pk).delete()
        if not result.index_entries:
            return

        rows = [
            PageIndexEntry(
                workspace=self.workspace,
                page_id=record.pk,
                kind=entry.kind,
                key=entry.key,
                value=entry.value,
                color=entry.colour,
                is_complete=entry.is_complete,
                assignee=users.get(entry.account_id),
                due_date=date.fromisoformat(entry.due_date) if entry.due_date else None,
                sort_order=entry.order,
            )
            for entry in result.index_entries
        ]
        PageIndexEntry.objects.bulk_create(rows, batch_size=500)
        summary.index_entries += len(rows)
