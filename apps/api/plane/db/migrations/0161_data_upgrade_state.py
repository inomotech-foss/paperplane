# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0160_page_approval_baseline"),
    ]

    operations = [
        migrations.CreateModel(
            name="DataUpgradeState",
            fields=[
                ("name", models.CharField(max_length=100, primary_key=True, serialize=False)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("done", "Done"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("cursor", models.JSONField(blank=True, null=True)),
                ("counts", models.JSONField(blank=True, default=dict)),
                ("error", models.TextField(blank=True, default="")),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("resumes", models.PositiveIntegerField(default=0)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Data Upgrade",
                "verbose_name_plural": "Data Upgrades",
                "db_table": "data_upgrades",
            },
        ),
    ]
