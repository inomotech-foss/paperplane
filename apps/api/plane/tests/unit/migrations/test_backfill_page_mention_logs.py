# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import importlib
import uuid

import pytest
from django.apps import apps

from plane.db.models import Page, PageLog

migration = importlib.import_module("plane.db.migrations.0155_backfill_page_mention_logs")

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


def mention(transaction):
    return (
        f'<mention-component id="{transaction}" entity_identifier="{uuid.uuid4()}" '
        'entity_name="user_mention"></mention-component>'
    )


def test_logs_unlogged_mentions_and_drops_soft_deleted_logs(workspace, create_user):
    logged, unlogged = uuid.uuid4(), uuid.uuid4()
    page = Page.objects.create(
        name="Imported",
        workspace=workspace,
        owned_by=create_user,
        description_html=f"<p>{mention(logged)}{mention(unlogged)}{mention('broken')}</p>",
    )
    PageLog.objects.create(page=page, workspace=workspace, transaction=logged, entity_name="user_mention")
    removed = PageLog.objects.create(page=page, workspace=workspace, entity_name="user_mention")
    PageLog.objects.filter(pk=removed.pk).delete()

    migration.backfill(apps, None)

    logs = PageLog.objects.filter(page=page)
    assert {log.transaction for log in logs} == {logged, unlogged}
    assert logs.get(transaction=unlogged).notified_at
    assert not PageLog.all_objects.filter(pk=removed.pk).exists()
