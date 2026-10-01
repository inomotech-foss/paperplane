# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for the merge_users management command.
"""

from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from plane.db.models import User, Workspace, WorkspaceMember


@pytest.mark.unit
class TestMergeUsersCommand:
    @pytest.mark.django_db
    def test_dry_run_then_merge(self):
        survivor = User.objects.create(email="survivor@plane.so", username="survivor")
        source = User.objects.create(email="source@plane.so", username="source")
        workspace = Workspace.objects.create(name="W", slug="w", owner=survivor)
        WorkspaceMember.objects.create(workspace=workspace, member=source, role=15)

        out = StringIO()
        call_command("merge_users", "source@plane.so", "survivor@plane.so", "--dry-run", stdout=out)

        assert "db.WorkspaceMember.member: moved 1, dropped 0" in out.getvalue()
        assert "would keep" in out.getvalue()
        source.refresh_from_db()
        assert source.deleted_at is None

        call_command("merge_users", "source@plane.so", "survivor@plane.so", "--keep-source-email", stdout=out)

        survivor.refresh_from_db()
        source.refresh_from_db()
        assert survivor.email == "source@plane.so"
        assert source.merged_into == survivor
        assert WorkspaceMember.objects.get(workspace=workspace, member=survivor).role == 15

    @pytest.mark.django_db
    def test_unknown_emails_fail(self):
        with pytest.raises(CommandError):
            call_command("merge_users", "nobody@plane.so", "nobody-else@plane.so")
