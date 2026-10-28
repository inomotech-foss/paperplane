# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Log the mentions of imported pages as already notified.

The importer wrote pages without logs, so their first edit would treat old
mentions as new. Soft-deleted logs are removed because they block a mention
from being logged again when it is restored.
"""

import uuid

from bs4 import BeautifulSoup
from django.db import migrations
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

    PageLog._base_manager.filter(deleted_at__isnull=False).delete()

    pages = Page.objects.filter(description_html__contains="<mention-component").only(
        "id", "workspace_id", "description_html"
    )
    for page in pages.iterator(chunk_size=200):
        logged = {str(t) for t in PageLog.objects.filter(page_id=page.id).values_list("transaction", flat=True)}
        logs = []
        for tag in BeautifulSoup(page.description_html, "html.parser").find_all("mention-component"):
            transaction_id = tag.get("id")
            if not _uuid_or_none(transaction_id) or not tag.get("entity_name") or transaction_id in logged:
                continue
            logged.add(transaction_id)
            logs.append(
                PageLog(
                    transaction=transaction_id,
                    page_id=page.id,
                    workspace_id=page.workspace_id,
                    entity_identifier=_uuid_or_none(tag.get("entity_identifier")),
                    entity_name=tag.get("entity_name")[:30],
                    notified_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
        PageLog.objects.bulk_create(logs, batch_size=200, ignore_conflicts=True)


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("db", "0154_pagelog_mention_notifications"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
