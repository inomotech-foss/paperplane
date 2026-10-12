# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import io
from unittest.mock import patch

import pytest

from plane.bgtasks.analytic_plot_export import EXPORT_TOO_LARGE_TEXT, send_export_email
from plane.utils.ms365_graph import MSGraphMessageTooLarge


@pytest.mark.unit
class TestSendExportEmail:
    def test_attaches_the_csv(self):
        with patch("plane.bgtasks.analytic_plot_export.send_email", return_value=True) as send_email:
            assert send_export_email("user@example.com", "acme", io.StringIO("a,b\n"), []) is True

        assert send_email.call_args.kwargs["attachments"] == [("acme-analytics.csv", "a,b\n")]

    def test_sends_a_notice_when_the_attachment_is_too_large(self):
        with patch(
            "plane.bgtasks.analytic_plot_export.send_email",
            side_effect=[MSGraphMessageTooLarge("too big"), True],
        ) as send_email:
            assert send_export_email("user@example.com", "acme", io.StringIO("a,b\n"), []) is True

        notice = send_email.call_args_list[1].kwargs
        assert notice["to"] == ["user@example.com"]
        assert notice["text_content"] == EXPORT_TOO_LARGE_TEXT
        assert "attachments" not in notice
