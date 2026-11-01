# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO
from unittest import mock

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from plane.db.models import Page
from plane.utils.content_validator import MAX_SIZE

UNSAFE = '<p onclick="steal()">hi</p><script>alert(1)</script>'
SAFE = "<p>hi</p>"


def _page(workspace, user, html, **extra):
    page = Page.objects.create(name="Notes", workspace=workspace, owned_by=user, **extra)
    Page.all_objects.filter(pk=page.pk).update(description_html=html)
    return Page.all_objects.get(pk=page.pk)


def _run(*args):
    out, err = StringIO(), StringIO()
    call_command("sanitize_page_html", *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


@pytest.mark.unit
@pytest.mark.django_db
class TestSanitizePageHtml:
    def test_dry_run_is_the_default_and_writes_nothing(self, workspace, create_user):
        page = _page(workspace, create_user, UNSAFE)

        out, _ = _run()

        assert f"would change {page.id}" in out
        assert "would change 1" in out
        assert "steal" not in out
        assert Page.all_objects.get(pk=page.pk).description_html == UNSAFE

    def test_apply_sanitizes_an_unsafe_page(self, workspace, create_user):
        page = _page(workspace, create_user, UNSAFE)

        _run("--apply")

        stored = Page.all_objects.get(pk=page.pk)
        assert stored.description_html == SAFE
        assert stored.description_stripped == "hi"
        assert stored.updated_at == page.updated_at

    def test_apply_leaves_a_safe_page_alone(self, workspace, create_user):
        page = _page(workspace, create_user, SAFE)

        with mock.patch.object(Page.all_objects, "bulk_update") as bulk_update:
            out, _ = _run("--apply")

        bulk_update.assert_not_called()
        assert "changed 0" in out
        assert Page.all_objects.get(pk=page.pk).updated_at == page.updated_at

    def test_covers_deleted_and_archived_pages(self, workspace, create_user):
        deleted = _page(workspace, create_user, UNSAFE, deleted_at=timezone.now())
        archived = _page(workspace, create_user, UNSAFE, archived_at=timezone.now().date())

        _run("--apply")

        assert Page.all_objects.get(pk=deleted.pk).description_html == SAFE
        assert Page.all_objects.get(pk=archived.pk).description_html == SAFE

    def test_a_rejected_page_is_counted_and_skipped(self, workspace, create_user):
        oversized = "<p>" + "a" * MAX_SIZE + "</p>"
        rejected = _page(workspace, create_user, oversized)
        unsafe = _page(workspace, create_user, UNSAFE)

        out, err = _run("--apply")

        assert f"rejected {rejected.id}" in err
        assert "changed 1, failed 1" in out
        assert Page.all_objects.get(pk=rejected.pk).description_html == oversized
        assert Page.all_objects.get(pk=unsafe.pk).description_html == SAFE

    def test_batches(self, workspace, create_user):
        pages = [_page(workspace, create_user, UNSAFE if i % 2 == 0 else SAFE) for i in range(5)]

        with mock.patch.object(Page.all_objects, "bulk_update", wraps=Page.all_objects.bulk_update) as bulk_update:
            out, _ = _run("--apply", "--batch-size", "2")

        assert [len(call.args[0]) for call in bulk_update.call_args_list] == [2, 1]
        assert "scanned 2," in out
        assert "scanned 4," in out
        assert "done: scanned 5, changed 3, failed 0" in out
        for page in pages:
            assert Page.all_objects.get(pk=page.pk).description_html == SAFE

    def test_rejects_a_batch_size_below_one(self):
        with pytest.raises(CommandError, match="batch-size"):
            _run("--batch-size", "0")
