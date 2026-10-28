# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0153_remove_issuetype_is_epic"),
    ]

    operations = [
        migrations.AddField(
            model_name="pagelog",
            name="notified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pagelog",
            name="triggered_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="page_logs_triggered",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunSQL("UPDATE page_logs SET notified_at = now()", reverse_sql=migrations.RunSQL.noop),
        migrations.AddIndex(
            model_name="pagelog",
            index=models.Index(
                condition=models.Q(("notified_at__isnull", True)),
                fields=["created_at"],
                name="pagelog_pending_mention_idx",
            ),
        ),
    ]
