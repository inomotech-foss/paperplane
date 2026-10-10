# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0147_project_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="intake",
            name="issue_type",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="intakes",
                to="db.issuetype",
            ),
        ),
    ]
