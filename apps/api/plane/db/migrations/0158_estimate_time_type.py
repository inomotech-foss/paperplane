# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0157_pql_dialect"),
    ]

    operations = [
        migrations.AlterField(
            model_name="estimate",
            name="type",
            field=models.CharField(
                choices=[("categories", "Categories"), ("points", "Points"), ("time", "Time")],
                default="categories",
                max_length=255,
            ),
        ),
    ]
