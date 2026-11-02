# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Every Plane table the importer writes, in load order.

A table loads after the tables its required references point at; a nullable
reference to a later table is filled in once that table is in. Anything not
listed here is accounted for in ``catalog``.
"""

from types import SimpleNamespace

from plane.db import models as m
from plane.db.models.issue import IssueAttachment
from plane.db.models.project import ProjectDeployBoard
from plane.utils.issue_type import link_starter_type

from .convert import archived_date, constant, material_icon, relation_type
from .entities import OUTSIDE_SELECTION, Entity

ALREADY_PRESENT = "already present"


def _keep_user(row, ctx):
    if row["id"] in ctx.state["create_users"]:
        return True
    if row["id"] in ctx.state["matched_users"]:
        return ALREADY_PRESENT
    return OUTSIDE_SELECTION


def _username(row, ctx):
    return ctx.state["create_users"][row["id"]]


def _unless_matched(row, ctx):
    """A user the target already had keeps their own profile and settings."""
    return ALREADY_PRESENT if row.get("user_id") in ctx.state["matched_users"] else True


def _keep_account(row, ctx):
    if row.get("user_id") in ctx.state["matched_users"]:
        return ALREADY_PRESENT
    taken = m.Account.objects.filter(provider=row.get("provider"), provider_account_id=row.get("provider_account_id"))
    return ALREADY_PRESENT if taken.exists() else True


def _keep_workspace(row, ctx):
    return True if ctx.workspaces is None or row.get("slug") in ctx.workspaces else OUTSIDE_SELECTION


def _note_default_type(row, ctx):
    if row.get("is_default"):
        ctx.state.setdefault("default_type_ids", set()).add(row["id"])
    return True


def _note_default_link(row, ctx):
    if row.get("is_default"):
        ctx.state.setdefault("default_links", set()).add((row.get("project_id"), row.get("issue_type_id")))
    return True


def _settle_project_types(ctx):
    """Every project gets a type, and each project's default is decided once.

    The default is a linked type Plane marked as default, on the type or on the
    link; failing that, the workspace "Task" type, linked and created as needed.
    """
    default_types = ctx.state.get("default_type_ids", set())
    default_links = ctx.state.get("default_links", set())
    defaults = {}
    projects = m.Project.all_objects.filter(id__in=ctx.ids.targets(m.Project))
    links = m.ProjectIssueType.objects.filter(
        project_id__in=ctx.ids.targets(m.Project), issue_type__is_active=True, issue_type__deleted_at__isnull=True
    ).order_by("created_at")
    linked = {}
    for link in links:
        linked.setdefault(link.project_id, []).append(link.issue_type_id)

    for project in projects:
        candidates = linked.get(project.id, [])
        chosen = next(
            (t for t in candidates if t in default_types or (project.id, t) in default_links),
            None,
        )
        if chosen is None:
            if not candidates:
                ctx.report.typed_projects += 1
            chosen = link_starter_type(SimpleNamespace(id=project.id, workspace_id=project.workspace_id)).id
        defaults[project.id] = chosen
    ctx.state["default_types"] = defaults


def _work_item_type(row, ctx):
    found = ctx.ids.get(m.IssueType, row.get("type_id"))
    if found is not None:
        return found
    ctx.report.typed += 1
    return ctx.state["default_types"].get(ctx.ids.get(m.Project, row.get("project_id")))


def _project_identifiers(ctx):
    """Plane CE keeps a project's key in its own table; create the rows it lacks."""
    projects = m.Project.all_objects.filter(id__in=ctx.ids.targets(m.Project)).exclude(project_identifier__isnull=False)
    m.ProjectIdentifier.objects.bulk_create(
        [m.ProjectIdentifier(project=p, workspace_id=p.workspace_id, name=p.identifier) for p in projects]
    )


def _count_file_objects(ctx):
    targets = ctx.ids.targets(m.FileAsset)
    ctx.report.file_objects = m.FileAsset.all_objects.filter(id__in=targets, is_uploaded=True).count()


ARCHIVED = {"archived_at": archived_date}

ENTITIES = (
    # Who
    Entity(m.User, keep=_keep_user, convert={"username": _username}, skip=("is_superuser", "is_staff")),
    Entity(m.Profile, keep=_unless_matched),
    Entity(m.Account, keep=_keep_account),
    Entity(m.UserNotificationPreference, keep=_unless_matched),
    # Workspaces
    Entity(m.Workspace, keep=_keep_workspace, convert={"pql_dialect": constant("plane")}),
    Entity(m.WorkspaceMember),
    Entity(m.WorkspaceMemberInvite),
    Entity(m.WorkspaceTheme),
    Entity(m.WorkspaceUserProperties),
    Entity(m.WorkspaceHomePreference),
    Entity(m.WorkspaceUserPreference),
    Entity(m.WorkspaceUserLink),
    Entity(m.IssueType, keep=_note_default_type, convert={"logo_props": material_icon}),
    Entity(m.Label),
    # Projects
    Entity(m.Project),
    Entity(m.ProjectIdentifier, after=_project_identifiers),
    Entity(m.ProjectMember),
    Entity(m.ProjectMemberInvite),
    Entity(m.ProjectUserProperty),
    Entity(m.ProjectPublicMember),
    Entity(m.ProjectLink),
    Entity(m.ProjectIssueType, keep=_note_default_link, after=_settle_project_types),
    Entity(m.State),
    Entity(m.Estimate),
    Entity(m.EstimatePoint),
    Entity(m.Intake),
    Entity(ProjectDeployBoard),
    Entity(m.DeployBoard),
    Entity(m.Cycle),
    Entity(m.CycleUserProperties),
    Entity(m.Module),
    Entity(m.ModuleMember),
    Entity(m.ModuleLink),
    Entity(m.ModuleUserProperties),
    # Work items
    Entity(m.Description),
    Entity(m.DescriptionVersion),
    Entity(m.Issue, convert={"type_id": _work_item_type, **ARCHIVED}),
    Entity(m.IssueSequence),
    Entity(m.IssueDescriptionVersion),
    Entity(m.IssueAssignee),
    Entity(m.IssueLabel),
    Entity(m.IssueSubscriber),
    Entity(m.IssueMention),
    Entity(m.IssueLink),
    Entity(IssueAttachment),
    Entity(m.IssueRelation, convert={"relation_type": relation_type}),
    Entity(m.IssueVote),
    Entity(m.IssueReaction),
    Entity(m.IssueComment),
    Entity(m.CommentReaction),
    Entity(m.IssueActivity),
    Entity(m.IssueVersion, convert=ARCHIVED),
    Entity(m.CycleIssue),
    Entity(m.ModuleIssue),
    Entity(m.IntakeIssue),
    Entity(m.DraftIssue),
    Entity(m.DraftIssueAssignee),
    Entity(m.DraftIssueLabel),
    Entity(m.DraftIssueModule),
    Entity(m.DraftIssueCycle),
    # Pages and the rest
    Entity(m.Page, convert=ARCHIVED),
    Entity(m.ProjectPage),
    Entity(m.PageVersion),
    Entity(m.PageLog),
    Entity(m.IssueView),
    Entity(m.AnalyticView),
    Entity(m.Sticky),
    Entity(m.UserFavorite),
    Entity(m.UserRecentVisit),
    Entity(m.FileAsset, after=_count_file_objects),
)

IMPORTED = frozenset(entity.table for entity in ENTITIES)
