# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0159_page_approvals"),
    ]

    operations = [
        migrations.AddField(
            model_name="pageapproval",
            name="baseline_version",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="+",
                to="db.pageversion",
            ),
        ),
        migrations.AddField(
            model_name="pageapproval",
            name="baselined_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pageapproval",
            name="baselined_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="pageapproval",
            name="legacy_approved_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pageapproval",
            name="legacy_approved_at_raw",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="pageapproval",
            name="legacy_approved_by",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pageapproval",
            name="legacy_status",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="pageapprovalevent",
            name="legacy_approved_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pageapprovalevent",
            name="legacy_approved_at_raw",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="pageapprovalevent",
            name="legacy_approved_by",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pageapprovalevent",
            name="legacy_status",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AlterField(
            model_name="pageapproval",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("in_review", "In review"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("baseline", "Baseline (migrated, not reviewed in Paperplane)"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="pageapprovalevent",
            name="action",
            field=models.CharField(
                choices=[
                    ("submitted", "Submitted"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("review_date_set", "Review date set"),
                    ("baselined", "Baselined (migrated, not reviewed in Paperplane)"),
                ],
                max_length=30,
            ),
        ),
    ]
