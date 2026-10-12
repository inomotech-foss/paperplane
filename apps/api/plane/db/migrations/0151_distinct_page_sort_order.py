# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Renumber page sibling groups that share sort orders, keeping the order the web list showed."""

from django.db import migrations

RENUMBER_CROWDED_SIBLINGS = """
WITH placed AS (
    SELECT DISTINCT ON (p.id) p.id, pp.project_id, p.parent_id, p.sort_order, p.name, p.created_at
    FROM pages p
    JOIN project_pages pp ON pp.page_id = p.id AND pp.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
    ORDER BY p.id, pp.created_at
),
crowded AS (
    SELECT project_id, parent_id
    FROM placed
    GROUP BY project_id, parent_id
    HAVING COUNT(*) > COUNT(DISTINCT sort_order)
),
ranked AS (
    SELECT placed.id, ROW_NUMBER() OVER (
        PARTITION BY placed.project_id, placed.parent_id
        ORDER BY placed.sort_order, LOWER(placed.name) COLLATE "C", placed.created_at DESC, placed.id
    ) AS position
    FROM placed
    JOIN crowded ON crowded.project_id = placed.project_id
        AND crowded.parent_id IS NOT DISTINCT FROM placed.parent_id
)
UPDATE pages SET sort_order = ranked.position * 10000
FROM ranked
WHERE pages.id = ranked.id
"""


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0150_require_issue_type"),
    ]

    operations = [
        migrations.RunSQL(RENUMBER_CROWDED_SIBLINGS, migrations.RunSQL.noop),
    ]
