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
            model_name="deployboard",
            name="intake_issue_type",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="intake_deploy_boards",
                to="db.issuetype",
            ),
        ),
        migrations.AddField(
            model_name="servicedeskconfig",
            name="issue_type",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="service_desk_configs",
                to="db.issuetype",
            ),
        ),
    ]
