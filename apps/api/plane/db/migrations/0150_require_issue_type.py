# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0149_backfill_issue_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="issue",
            name="type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="issue_type",
                to="db.issuetype",
            ),
        ),
        migrations.AddConstraint(
            model_name="deployboard",
            constraint=models.CheckConstraint(
                condition=models.Q(("intake__isnull", True), ("intake_issue_type__isnull", False), _connector="OR"),
                name="deploy_board_intake_has_issue_type",
            ),
        ),
        migrations.AddConstraint(
            model_name="servicedeskconfig",
            constraint=models.CheckConstraint(
                condition=models.Q(("is_enabled", False), ("issue_type__isnull", False), _connector="OR"),
                name="service_desk_config_enabled_has_issue_type",
            ),
        ),
        migrations.RemoveField(
            model_name="issuetype",
            name="is_default",
        ),
        migrations.RemoveField(
            model_name="projectissuetype",
            name="is_default",
        ),
    ]
