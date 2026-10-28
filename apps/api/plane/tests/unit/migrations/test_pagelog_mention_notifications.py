# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import importlib
import uuid

import pytest
from django.apps import apps

from plane.db.models import Page, PageLog

migration = importlib.import_module("plane.db.migrations.0154_pagelog_mention_notifications")

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


def mention(transaction):
    return (
        f'<mention-component id="{transaction}" entity_identifier="{uuid.uuid4()}" '
        'entity_name="user_mention"></mention-component>'
    )


def test_logs_unlogged_mentions_as_notified(workspace, create_user):
    logged, unlogged = uuid.uuid4(), uuid.uuid4()
    page = Page.objects.create(
        name="Imported",
        workspace=workspace,
        owned_by=create_user,
        description_html=f"<p>{mention(logged)}{mention(unlogged)}{mention('broken')}</p>",
    )
    PageLog.objects.create(page=page, workspace=workspace, transaction=logged, entity_name="user_mention")

    migration.backfill(apps, None)

    logs = PageLog.objects.filter(page=page)
    assert {log.transaction for log in logs} == {logged, unlogged}
    assert all(log.notified_at for log in logs)
