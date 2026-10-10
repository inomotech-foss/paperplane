# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0150_require_issue_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="intake",
            name="issue_type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="intakes",
                to="db.issuetype",
            ),
        ),
        migrations.AlterField(
            model_name="issue",
            name="type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="issue_type",
                to="db.issuetype",
            ),
        ),
    ]
