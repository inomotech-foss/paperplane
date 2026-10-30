# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0156_merge_upstream_2026_10"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspace",
            name="pql_dialect",
            field=models.CharField(choices=[("jql", "JQL"), ("plane", "Plane")], default="jql", max_length=8),
        ),
        migrations.AddField(
            model_name="workspacemember",
            name="pql_dialect",
            field=models.CharField(choices=[("jql", "JQL"), ("plane", "Plane")], default=None, max_length=8, null=True),
        ),
    ]
