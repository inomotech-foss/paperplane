# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Track notifications for page mentions and log the mentions of imported pages.

Every existing mention counts as already notified. Imported pages have no logs
at all, so their mentions are logged here. Otherwise the first edit of such a
page would treat old mentions as new.
"""

import uuid

import django.db.models.deletion
from bs4 import BeautifulSoup
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def _uuid_or_none(value):
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


def backfill(apps, schema_editor):
    Page = apps.get_model("db", "Page")
    PageLog = apps.get_model("db", "PageLog")
    now = timezone.now()

    PageLog.objects.update(notified_at=now)

    pages = Page.objects.filter(description_html__contains="<mention-component").only(
        "id", "workspace_id", "description_html"
    )
    for page in pages.iterator(chunk_size=200):
        logged = {str(t) for t in PageLog.objects.filter(page_id=page.id).values_list("transaction", flat=True)}
        logs = []
        for tag in BeautifulSoup(page.description_html, "html.parser").find_all("mention-component"):
            transaction = tag.get("id")
            if not _uuid_or_none(transaction) or transaction in logged:
                continue
            logged.add(transaction)
            logs.append(
                PageLog(
                    transaction=transaction,
                    page_id=page.id,
                    workspace_id=page.workspace_id,
                    entity_identifier=_uuid_or_none(tag.get("entity_identifier")),
                    entity_name=tag.get("entity_name"),
                    notified_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
        PageLog.objects.bulk_create(logs, batch_size=200, ignore_conflicts=True)


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
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
