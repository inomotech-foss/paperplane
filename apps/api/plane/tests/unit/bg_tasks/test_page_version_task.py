# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.bgtasks.page_version_task import track_page_version
from plane.db.models import Page, PageVersion

BODY = {"type": "doc", "content": [{"type": "paragraph"}]}


def _edit(page, user, html):
    before = json.dumps({"description_html": page.description_html})
    Page.objects.filter(pk=page.pk).update(description_html=html, description_json=BODY)
    track_page_version(page.id, before, user.id)


@pytest.mark.unit
@pytest.mark.django_db
class TestTrackPageVersion:
    def test_an_edit_records_a_version(self, workspace, create_user):
        page = Page.objects.create(name="Notes", workspace=workspace, owned_by=create_user)

        _edit(page, create_user, "<p>first</p>")

        version = PageVersion.objects.get(page=page)
        assert version.description_html == "<p>first</p>"
        assert version.description_json == BODY

    def test_a_quick_second_edit_updates_the_same_version(self, workspace, create_user):
        page = Page.objects.create(name="Notes", workspace=workspace, owned_by=create_user)

        _edit(page, create_user, "<p>first</p>")
        _edit(Page.objects.get(pk=page.pk), create_user, "<p>second</p>")

        assert PageVersion.objects.get(page=page).description_html == "<p>second</p>"
