# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import IntegrityError, transaction

from plane.db.models import IssueLink, User, Workspace

from .catalog import skip_reason
from .convert import page_links
from .entities import Context, Entity, load, resolve_pending
from .ids import IdMap, plan_users
from .registry import ENTITIES, IMPORTED
from .report import ImportReport
from .version import source_version


class ImportRefused(Exception):
    """The target or the options rule the import out before anything is written."""


class ImportConflict(Exception):
    """A row clashes with a target row on a unique key other than id."""


class _Rows:
    """A source of one table's rows, for rows the importer makes itself."""

    def __init__(self, table, rows):
        self.table, self._rows = table, rows

    def rows(self, table):
        return iter(self._rows) if table == self.table else iter(())


class PlaneImporter:
    """Imports a Plane database into PaperPlane through the models.

    Writes through the ORM rather than copying tables, so the two schemas never
    have to match: each PaperPlane model takes the source columns it knows and
    its own defaults for the rest. Source ids, authors and dates are kept, so
    ``ABC-123`` stays ``ABC-123`` and history reads as it did in Plane.
    Idempotent on id: with ``allow_existing`` a re-run updates in place.
    """

    def __init__(self, source, web_url, workspaces=None, allow_existing=False):
        self.source = source
        self.web_url = web_url
        self.workspaces = set(workspaces) if workspaces else None
        self.allow_existing = allow_existing

    def run(self, dry_run=False):
        report = ImportReport(dry_run=dry_run, source=source_version(self.source))
        selected = self._preflight()
        ctx = Context(
            ids=IdMap(),
            report=report,
            web_url=self.web_url,
            workspaces=self.workspaces,
            allow_existing=self.allow_existing,
        )
        table = None
        try:
            with transaction.atomic():
                self._plan_users(ctx, selected)
                ctx.state["relation_definitions"] = {
                    row["id"]: row.get("name") for row in self.source.rows("work_item_relation_definitions")
                }
                for entity in ENTITIES:
                    table = entity.table
                    load(entity, self.source, ctx)

                table = "workitem_pages"
                links = Entity(IssueLink, table=table)
                report.page_links = load(links, _Rows(table, page_links(self.source, ctx)), ctx)
                resolve_pending(ctx)
                if dry_run:
                    transaction.set_rollback(True)
        except IntegrityError as error:
            # Upserts key on id only; a re-run onto a target that gained rows
            # of its own can clash on a natural key instead.
            raise ImportConflict(f"while loading {table}: {str(error).strip()}") from error

        self._account_for_tables(report)
        return report

    def _preflight(self):
        """The source workspaces to import, after checking the target can take them."""
        workspaces = list(self.source.rows("workspaces"))
        if self.workspaces is not None:
            missing = self.workspaces - {row["slug"] for row in workspaces}
            if missing:
                raise ImportRefused(f"no workspace in the source with slug {', '.join(sorted(missing))}")
            workspaces = [row for row in workspaces if row["slug"] in self.workspaces]

        existing = dict(
            Workspace.all_objects.filter(slug__in=[row["slug"] for row in workspaces]).values_list("slug", "id")
        )
        for row in workspaces:
            if row["slug"] not in existing:
                continue
            if not self.allow_existing:
                raise ImportRefused(
                    f"the target already has workspace {row['slug']!r}; pass --allow-existing to import into it again"
                )
            if existing[row["slug"]] != row["id"]:
                raise ImportRefused(
                    f"the target's workspace {row['slug']!r} is a different workspace from the source's; "
                    "rename one of them first"
                )
        return workspaces

    def _plan_users(self, ctx, workspaces):
        """Members and owners of the imported workspaces, matched or created."""
        workspace_ids = {row["id"] for row in workspaces}
        wanted = {row["owner_id"] for row in workspaces}
        wanted |= {
            row["member_id"]
            for row in self.source.rows("workspace_members")
            if row.get("workspace_id") in workspace_ids
        }
        plan = plan_users(self.source.rows("users"), wanted)
        for source_id, target_id in plan.matched.items():
            ctx.ids.add(User, source_id, target_id)
        ctx.state["create_users"] = {row["id"]: row["username"] for row in plan.create}
        ctx.state["matched_users"] = set(plan.matched)
        ctx.report.matched_users = len(plan.matched)
        ctx.report.renamed_users = plan.renamed

    def _account_for_tables(self, report):
        for table, rows in self.source.tables().items():
            if not rows or table in IMPORTED:
                continue
            reason = skip_reason(table)
            if reason is None:
                report.unknown[table] = rows
            elif table != "workitem_pages":
                report.skipped[table] = (rows, reason)
