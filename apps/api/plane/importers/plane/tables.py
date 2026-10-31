# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Which Plane tables the importer copies, in load order, and how.

Both schemas share history up to db/0121, so most tables copy column for
column. A transform replaces a shared column's value; a default fills a column
only the target has. Both are SQL expressions evaluated on the source row.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TableSpec:
    name: str
    transforms: dict = field(default_factory=dict)
    defaults: dict = field(default_factory=dict)


ARCHIVED_DATE = {"archived_at": "archived_at::date"}

RELATION_TYPE = (
    "COALESCE(NULLIF(relation_type, ''), "
    "(SELECT lower(replace(d.name, ' ', '_')) FROM work_item_relation_definitions d WHERE d.id = definition_id), "
    "'relates_to')"
)

TABLES = (
    TableSpec("users"),
    TableSpec("profiles"),
    TableSpec("workspaces", defaults={"pql_dialect": "'plane'"}),
    TableSpec("workspace_members"),
    TableSpec("workspace_member_invites"),
    TableSpec("workspace_user_properties"),
    TableSpec("workspace_home_preferences"),
    TableSpec("workspace_user_preferences"),
    TableSpec("workspace_user_links"),
    TableSpec("user_notification_preferences"),
    TableSpec("user_recent_visits"),
    TableSpec("projects", defaults={"issue_view": "true"}),
    TableSpec("project_members"),
    TableSpec("project_user_properties"),
    TableSpec("states"),
    TableSpec("labels"),
    TableSpec("issue_types"),
    TableSpec("project_issue_types"),
    TableSpec("issues", transforms=ARCHIVED_DATE),
    TableSpec("issue_sequences"),
    TableSpec("descriptions"),
    TableSpec("issue_description_versions"),
    TableSpec("issue_assignees"),
    TableSpec("issue_labels"),
    TableSpec("issue_subscribers"),
    TableSpec("issue_mentions"),
    TableSpec("issue_links"),
    TableSpec("issue_relations", transforms={"relation_type": RELATION_TYPE}),
    TableSpec("issue_comments"),
    TableSpec("issue_activities"),
    TableSpec("cycles"),
    TableSpec("cycle_issues"),
    TableSpec("cycle_user_properties"),
    TableSpec("modules"),
    TableSpec("module_issues"),
    TableSpec("issue_views"),
    TableSpec("pages", transforms=ARCHIVED_DATE),
    TableSpec("project_pages"),
    TableSpec("page_versions"),
    TableSpec("page_logs"),
    TableSpec("file_assets"),
    TableSpec("deploy_boards"),
)

_RUNTIME = "runtime state, rebuilt by the new instance"
_SECRET = "holds secrets tied to the old SECRET_KEY"
_COMMERCIAL = "Plane Commercial feature with no PaperPlane equivalent"

SKIPPED = {
    "api_tokens": _SECRET,
    "application_secrets": _SECRET,
    "workspace_credentials": _SECRET,
    "instance_configurations": _SECRET,
    "instances": _RUNTIME,
    "instance_admins": _RUNTIME,
    "sessions": _RUNTIME,
    "devices": _RUNTIME,
    "notifications": _RUNTIME,
    "email_notification_logs": _RUNTIME,
    "webhooks": "integration endpoints; set up again",
    "webhook_logs": _RUNTIME,
    "outbox": _RUNTIME,
    "processed_automation_events": _RUNTIME,
    "audit_logs": _RUNTIME,
    "audit_logs_2026_08": _RUNTIME,
    "audit_logs_2026_10": _RUNTIME,
    "permission_audit_logs": _RUNTIME,
    "auth_permission": _RUNTIME,
    "django_content_type": _RUNTIME,
    "django_migrations": _RUNTIME,
    "django_celery_beat_crontabschedule": _RUNTIME,
    "django_celery_beat_intervalschedule": _RUNTIME,
    "django_celery_beat_periodictask": _RUNTIME,
    "django_celery_beat_periodictasks": _RUNTIME,
    "oauth_access_tokens": _SECRET,
    "oauth_refresh_tokens": _SECRET,
    "oauth_grants": _SECRET,
    "oauth_applications": _SECRET,
    "mcp_applications": _SECRET,
    "workspace_app_installations": _COMMERCIAL,
    "workspace_connections": _COMMERCIAL,
    "workspace_entity_connections": _COMMERCIAL,
    "workspace_licenses": _COMMERCIAL,
    "workspace_features": _COMMERCIAL,
    "workspace_member_activities": _COMMERCIAL,
    "project_member_activities": _COMMERCIAL,
    "project_activities": _COMMERCIAL,
    "project_attributes": _COMMERCIAL,
    "project_features": _COMMERCIAL,
    "project_states": _COMMERCIAL,
    "entity_issue_state_activities": _COMMERCIAL,
    "entity_progress": _COMMERCIAL,
    "epic_user_properties": _COMMERCIAL,
    "initiative_user_properties": _COMMERCIAL,
    "milestones": _COMMERCIAL,
    "milestone_issues": _COMMERCIAL,
    "page_references": _COMMERCIAL,
    "permission_schemes": _COMMERCIAL,
    "permission_scheme_activities": _COMMERCIAL,
    "resource_permissions": _COMMERCIAL,
    "role_permission_schemes": _COMMERCIAL,
    "roles": _COMMERCIAL,
    "work_item_relation_definitions": "folded into issue_relations.relation_type",
    "workitem_pages": "converted to work item links",
}


def plan_columns(source_cols, target_cols, spec):
    """The aliased SELECT list that maps a source row onto the target table."""
    select = {}
    for column in source_cols.keys() & target_cols:
        select[column] = spec.transforms.get(column, f'"{column}"')
    for column, expression in spec.defaults.items():
        if column in target_cols and column not in source_cols:
            select[column] = expression
    return [f'{expression} AS "{column}"' for column, expression in sorted(select.items())]
