# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import mimetypes
import uuid

from bs4 import BeautifulSoup
from django.conf import settings

from plane.db.models import FileAsset
from plane.settings.storage import S3Storage
from plane.utils.path_validator import sanitize_filename

from .macros import DIAGRAM_PREVIEW_SUFFIX
from .resolvers import ResolvedAttachment

# Extensions mimetypes does not know but the editor needs to store.
EXTRA_MIME_TYPES = {".drawio": "application/xml"}

ATTACHMENT_URL_TEMPLATE = "/api/assets/v2/workspaces/{slug}/projects/{project}/pages/{page}/attachments/{asset}/"


def inline_filenames(body):
    """Attachments the page renders in its body rather than listing as files.

    These become PAGE_DESCRIPTION assets so the attachments tab stays a list of
    documents instead of every image and render artefact on the page.
    """
    soup = BeautifulSoup(body or "", "html.parser")
    names = set()

    for image in soup.find_all("ac:image"):
        attachment = image.find("ri:attachment")
        filename = attachment.get("ri:filename") if attachment is not None else None
        if filename:
            names.add(filename)

    # A draw.io diagram is a pair: the editable source, which belongs in the
    # attachments tab, and a rendered preview, which does not.
    for macro in soup.find_all("ac:structured-macro", attrs={"ac:name": "drawio"}):
        parameter = macro.find("ac:parameter", attrs={"ac:name": "diagramName"})
        diagram_name = parameter.get_text().strip() if parameter is not None else ""
        if diagram_name:
            names.add(diagram_name + DIAGRAM_PREVIEW_SUFFIX)

    return names


class AttachmentUploader:
    """Uploads a page's backed-up Confluence attachments as file assets.

    Idempotent on ``(external_source, external_id)``: a re-run reuses the
    existing asset instead of transferring the file again, so re-importing a
    space to pick up converter improvements costs nothing in storage.
    """

    def __init__(self, workspace, project, backup, external_source, storage=None):
        self.workspace = workspace
        self.project = project
        self.backup = backup
        self.external_source = external_source
        self.storage = storage or S3Storage()
        self.unsupported = set()

    def upload_for_page(self, confluence_page_id, page, body):
        """Returns filename -> ResolvedAttachment for the converter to use."""
        inline = inline_filenames(body)
        resolved = {}

        for path in self.backup.attachments(confluence_page_id):
            attachment = self._upload(path, confluence_page_id, page, path.name in inline)
            if attachment is not None:
                resolved[path.name] = attachment

        return resolved

    def _upload(self, path, confluence_page_id, page, is_inline):
        content_type = self._content_type(path)
        if content_type not in settings.ATTACHMENT_MIME_TYPES:
            self.unsupported.add(path.name)
            return None

        external_id = f"{confluence_page_id}/{path.name}"
        asset = FileAsset.objects.filter(
            workspace=self.workspace,
            external_source=self.external_source,
            external_id=external_id,
        ).first()

        if asset is None:
            asset = self._create(path, external_id, page, content_type, is_inline)
            if asset is None:
                return None

        return ResolvedAttachment(
            id=str(asset.id),
            filename=path.name,
            is_image=content_type.startswith("image/"),
            url=ATTACHMENT_URL_TEMPLATE.format(
                slug=self.workspace.slug, project=self.project.id, page=page.id, asset=asset.id
            ),
        )

    def _create(self, path, external_id, page, content_type, is_inline):
        name = sanitize_filename(path.name) or "unnamed"
        asset_key = f"{self.workspace.id}/{uuid.uuid4().hex}-{name}"
        size = path.stat().st_size

        with path.open("rb") as handle:
            if not self.storage.upload_file(handle, asset_key, content_type=content_type):
                self.unsupported.add(path.name)
                return None

        return FileAsset.objects.create(
            attributes={"name": name, "type": content_type, "size": size},
            asset=asset_key,
            size=size,
            is_uploaded=True,
            workspace=self.workspace,
            project=self.project,
            page=page,
            created_by=page.owned_by,
            entity_type=(
                FileAsset.EntityTypeContext.PAGE_DESCRIPTION
                if is_inline
                else FileAsset.EntityTypeContext.PAGE_ATTACHMENT
            ),
            external_source=self.external_source,
            external_id=external_id,
        )

    @staticmethod
    def _content_type(path):
        suffix = path.suffix.lower()
        if suffix in EXTRA_MIME_TYPES:
            return EXTRA_MIME_TYPES[suffix]
        return mimetypes.guess_type(path.name)[0]
