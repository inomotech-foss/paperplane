# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Give every work item, service desk, published intake form and "create work item" automation a type.

The type is the workspace's default type, else its "Task" type, else a new
"Task" type. It is linked to every project that needs it first.
"""

from django.db import migrations

STARTER_CANDIDATES = """
    SELECT 1 FROM issue_types it
    WHERE it.workspace_id = w.id AND it.deleted_at IS NULL AND NOT it.is_epic
      AND (it.is_default OR it.name = 'Task')
"""

CREATE_TASK_TYPES = f"""
INSERT INTO issue_types
    (id, created_at, updated_at, workspace_id, name, description, logo_props,
     is_epic, is_default, is_active, level)
SELECT gen_random_uuid(), now(), now(), w.id, 'Task', '', '{{}}', false, false, true, 0
FROM workspaces w
WHERE EXISTS (SELECT 1 FROM projects p WHERE p.workspace_id = w.id)
  AND NOT EXISTS ({STARTER_CANDIDATES})
"""

STARTER_TYPES = """
CREATE TEMPORARY TABLE starter_types ON COMMIT DROP AS
SELECT DISTINCT ON (it.workspace_id) it.workspace_id, it.id AS issue_type_id
FROM issue_types it
WHERE it.deleted_at IS NULL AND NOT it.is_epic AND (it.is_default OR it.name = 'Task')
ORDER BY it.workspace_id, it.is_default DESC, it.created_at, it.id
"""

LINK_STARTER_TYPES = """
INSERT INTO project_issue_types
    (id, created_at, updated_at, project_id, workspace_id, issue_type_id, level, is_default)
SELECT gen_random_uuid(), now(), now(), p.id, p.workspace_id, s.issue_type_id, 0, false
FROM projects p
JOIN starter_types s ON s.workspace_id = p.workspace_id
WHERE (
    EXISTS (SELECT 1 FROM issues i WHERE i.project_id = p.id AND i.type_id IS NULL)
    OR EXISTS (SELECT 1 FROM service_desk_configs c WHERE c.project_id = p.id)
    OR EXISTS (SELECT 1 FROM deploy_boards d WHERE d.project_id = p.id AND d.intake_id IS NOT NULL)
    OR NOT EXISTS (
        SELECT 1 FROM project_issue_types l
        JOIN issue_types t ON t.id = l.issue_type_id AND t.deleted_at IS NULL
        WHERE l.project_id = p.id AND l.deleted_at IS NULL
    )
)
AND NOT EXISTS (
    SELECT 1 FROM project_issue_types l
    WHERE l.project_id = p.id AND l.issue_type_id = s.issue_type_id AND l.deleted_at IS NULL
)
"""

TYPE_ISSUES = """
UPDATE issues i SET type_id = s.issue_type_id
FROM starter_types s
WHERE i.workspace_id = s.workspace_id AND i.type_id IS NULL
"""

TYPE_SERVICE_DESKS = """
UPDATE service_desk_configs c SET issue_type_id = s.issue_type_id
FROM starter_types s
WHERE c.workspace_id = s.workspace_id AND c.issue_type_id IS NULL
"""

TYPE_INTAKE_FORMS = """
UPDATE deploy_boards d SET intake_issue_type_id = s.issue_type_id
FROM starter_types s
WHERE d.workspace_id = s.workspace_id AND d.intake_id IS NOT NULL AND d.intake_issue_type_id IS NULL
"""

TYPE_CREATE_ACTIONS = """
UPDATE automation_actions a
SET config = jsonb_set(COALESCE(a.config, '{}'::jsonb), '{type_id}', to_jsonb(s.issue_type_id::text))
FROM starter_types s
WHERE a.workspace_id = s.workspace_id
  AND a.action_type = 'create_work_item'
  AND COALESCE(a.config->>'type_id', '') = ''
"""


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0148_issue_type_references"),
    ]

    operations = [
        migrations.RunSQL(
            [
                CREATE_TASK_TYPES,
                STARTER_TYPES,
                LINK_STARTER_TYPES,
                TYPE_ISSUES,
                TYPE_SERVICE_DESKS,
                TYPE_INTAKE_FORMS,
                TYPE_CREATE_ACTIONS,
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
