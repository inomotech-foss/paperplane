# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from pathlib import Path

import pytest

from plane.importers.confluence import inline_filenames
from plane.importers.confluence.assets import AttachmentUploader
from plane.importers.confluence.backup import ConfluenceBackup


@pytest.mark.unit
class TestInlineFilenames:
    """Files the body renders itself become PAGE_DESCRIPTION assets; the rest
    are listed in the attachments tab."""

    def test_embedded_images_are_inline(self):
        body = '<ac:image><ri:attachment ri:filename="diagram.png"/></ac:image>'

        assert inline_filenames(body) == {"diagram.png"}

    def test_a_linked_attachment_is_not_inline(self):
        body = '<p><ac:link><ri:attachment ri:filename="spec.pdf"/></ac:link></p>'

        assert inline_filenames(body) == set()

    def test_only_the_drawio_preview_is_inline(self):
        """The source stays a real attachment so it can be downloaded and,
        later, edited; the rendered preview is just how the block draws."""
        body = (
            '<ac:structured-macro ac:name="drawio">'
            '<ac:parameter ac:name="diagramName">Flow.drawio</ac:parameter></ac:structured-macro>'
        )

        assert inline_filenames(body) == {"Flow.drawio.png"}

    def test_a_drawio_macro_without_a_name_contributes_nothing(self):
        body = '<ac:structured-macro ac:name="drawio"/>'

        assert inline_filenames(body) == set()

    def test_external_images_contribute_nothing(self):
        body = '<ac:image><ri:url ri:value="https://x.test/a.png"/></ac:image>'

        assert inline_filenames(body) == set()

    def test_empty_body_is_handled(self):
        assert inline_filenames("") == set()
        assert inline_filenames(None) == set()


@pytest.mark.unit
class TestContentType:
    def test_drawio_is_recognised(self):
        """mimetypes does not know .drawio, and without a type the file would
        be rejected and the diagram lost."""
        assert AttachmentUploader._content_type(Path("Flow.drawio")) == "application/xml"

    def test_extension_case_does_not_matter(self):
        assert AttachmentUploader._content_type(Path("Flow.DRAWIO")) == "application/xml"

    def test_known_types_come_from_mimetypes(self):
        assert AttachmentUploader._content_type(Path("spec.pdf")) == "application/pdf"

    def test_unknown_types_have_none(self):
        assert AttachmentUploader._content_type(Path("mystery.zzz")) is None


@pytest.mark.unit
class TestBackupAttachmentListing:
    def _space(self, tmp_path, page_id, filenames):
        directory = tmp_path / "confluence" / "IMS" / "attachments" / page_id
        directory.mkdir(parents=True)
        for filename in filenames:
            (directory / filename).write_text("x")
        return ConfluenceBackup(tmp_path, "IMS")

    def test_editor_working_copies_are_skipped(self, tmp_path):
        """draw.io leaves ~<name>.tmp files beside the diagram it edits."""
        backup = self._space(
            tmp_path,
            "100",
            ["Flow.drawio", "Flow.drawio.png", "~Flow.drawio.tmp", "~drawio~abc~Flow.drawio.tmp", ".DS_Store"],
        )

        assert [path.name for path in backup.attachments("100")] == ["Flow.drawio", "Flow.drawio.png"]

    def test_a_page_with_no_attachments_gives_an_empty_list(self, tmp_path):
        backup = self._space(tmp_path, "100", [])

        assert backup.attachments("101") == []
