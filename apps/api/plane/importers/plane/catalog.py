# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The Plane tables the importer leaves out, and why.

Anything a Plane database holds is either imported (see ``registry``), folded
into another table, or listed here. A table in none of them is reported as
unknown, with its row count, and the import goes on without it.
"""

import re

RUNTIME = "runtime state, rebuilt by the new instance"
SECRET = "holds secrets tied to the old instance"
INTEGRATION = "integration, set up again on the new instance"
COMMERCIAL = "Plane Commercial feature with no PaperPlane equivalent"
LEGACY = "legacy table Plane no longer writes"
FOLDED = "folded into"

_EXACT = {
    "instances": RUNTIME,
    "instance_admins": RUNTIME,
    "sessions": RUNTIME,
    "devices": RUNTIME,
    "device_sessions": RUNTIME,
    "notifications": RUNTIME,
    "email_notification_logs": RUNTIME,
    "webhook_logs": RUNTIME,
    "webhook_events": RUNTIME,
    "outbox": RUNTIME,
    "processed_automation_events": RUNTIME,
    "api_activity_logs": RUNTIME,
    "permission_audit_logs": RUNTIME,
    "exporters": RUNTIME,
    "importers": RUNTIME,
    "import_jobs": RUNTIME,
    "import_reports": RUNTIME,
    "import_execution_logs": RUNTIME,
    "label_import_jobs": RUNTIME,
    "changelogs": RUNTIME,
    "users_groups": RUNTIME,
    "users_user_permissions": RUNTIME,
    "api_tokens": SECRET,
    "application_secrets": SECRET,
    "instance_configurations": SECRET,
    "workspace_credentials": SECRET,
    "social_login_connections": SECRET,
    "external_token_providers": SECRET,
    "webhooks": INTEGRATION,
    "webhook_scopes": INTEGRATION,
    "project_webhooks": INTEGRATION,
    "integrations": INTEGRATION,
    "workspace_integrations": INTEGRATION,
    "slack_project_syncs": INTEGRATION,
    "workspace_app_installations": INTEGRATION,
    "workspace_connections": INTEGRATION,
    "workspace_entity_connections": INTEGRATION,
    "identity_providers": INTEGRATION,
    "identity_provider_domains": INTEGRATION,
    "domains": INTEGRATION,
    "group_mappings": INTEGRATION,
    "group_sync_configs": INTEGRATION,
    "workspace_group_mappings": INTEGRATION,
    "work_item_comment_sources": INTEGRATION,
    "workitem_pages": f"{FOLDED} work item links",
    "work_item_relation_definitions": f"{FOLDED} the work item relation type",
    "cycle_settings": COMMERCIAL,
    "automated_cycle_logs": COMMERCIAL,
    "entity_issue_state_activities": COMMERCIAL,
    "entity_progress": COMMERCIAL,
    "entity_updates": COMMERCIAL,
    "update_reactions": COMMERCIAL,
    "epic_user_properties": COMMERCIAL,
    "formula_properties": COMMERCIAL,
    "issue_blockers": LEGACY,
    "issue_worklogs": COMMERCIAL,
    "intake_emails": COMMERCIAL,
    "intake_forms": COMMERCIAL,
    "intake_form_fields": COMMERCIAL,
    "intake_responsibilities": COMMERCIAL,
    "intake_settings": COMMERCIAL,
    "draft_issue_property_values": COMMERCIAL,
    "permission_schemes": COMMERCIAL,
    "permission_scheme_activities": COMMERCIAL,
    "resource_permissions": COMMERCIAL,
    "role_permission_schemes": COMMERCIAL,
    "roles": COMMERCIAL,
    "role_activities": COMMERCIAL,
    "teams": LEGACY,
    "widgets": COMMERCIAL,
    "workspace_activities": COMMERCIAL,
    "workspace_features": COMMERCIAL,
    "workspace_licenses": COMMERCIAL,
    "workspace_member_activities": COMMERCIAL,
    "workspace_governance_migrations": COMMERCIAL,
}

_FAMILIES = [
    (re.compile(r"audit_logs(_.+)?"), RUNTIME),
    (re.compile(r"django_.+|auth_.+"), RUNTIME),
    (re.compile(r"oauth.+|mcp_.+"), SECRET),
    (re.compile(r"github_.+"), INTEGRATION),
    (
        re.compile(
            r"(agent_run|artifact|automation|collection|customer|dashboard|initiative|milestone|native_agent"
            r"|node_execution|recurring_workitem|release|script|team_space|template|workflow|workitem_template"
            r"|issue_propert|issue_type_propert|work_item_propert|work_item_type_)[a-z_]*"
        ),
        COMMERCIAL,
    ),
    (
        re.compile(
            r"page_(comments?|comment_reactions|labels?|label_associations|users|subscribers|templates|widgets"
            r"|collections|references)"
        ),
        COMMERCIAL,
    ),
    (
        re.compile(
            r"project_(labels|label_associations|comments|comment_reactions|reactions|subscribers|templates"
            r"|states|attributes|features|activities|member_activities)"
        ),
        COMMERCIAL,
    ),
    (re.compile(r"(initiative|epic)_user_properties"), COMMERCIAL),
]


def skip_reason(table):
    """Why `table` is not imported, or None when the importer does not know it."""
    if table in _EXACT:
        return _EXACT[table]
    for pattern, reason in _FAMILIES:
        if pattern.fullmatch(table):
            return reason
    return None
