# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Subscribe every assignee who is not subscribed to their work item.

Imports created assignees without subscribers, so those people got no
notifications. A soft-deleted subscriber row means the person unsubscribed,
so those pairs are left alone.
"""

from django.db import migrations

SUBSCRIBE_ASSIGNEES = """
INSERT INTO issue_subscribers
    (id, created_at, updated_at, issue_id, subscriber_id, project_id, workspace_id)
SELECT gen_random_uuid(), now(), now(), a.issue_id, a.assignee_id, i.project_id, i.workspace_id
FROM issue_assignees a
JOIN issues i ON i.id = a.issue_id AND i.deleted_at IS NULL
WHERE a.deleted_at IS NULL
AND NOT EXISTS (
    SELECT 1 FROM issue_subscribers s WHERE s.issue_id = a.issue_id AND s.subscriber_id = a.assignee_id
)
"""


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0151_distinct_page_sort_order"),
    ]

    operations = [
        migrations.RunSQL(SUBSCRIBE_ASSIGNEES, reverse_sql=migrations.RunSQL.noop),
    ]
