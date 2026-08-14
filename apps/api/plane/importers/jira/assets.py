# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import mimetypes
import uuid

from django.conf import settings

from plane.db.models import FileAsset
from plane.settings.storage import S3Storage
from plane.utils.path_validator import sanitize_filename

from ..confluence.resolvers import ResolvedAttachment

ATTACHMENT_URL_TEMPLATE = "/api/assets/v2/workspaces/{slug}/projects/{project}/issues/{issue}/attachments/{asset}/"


def attachment_source_path(backup, issue_key, filename):
    """Where an issue's attachment sits in the backup tree.

    UNVERIFIED. The layout `jira/<KEY>/attachments/<ISSUE_KEY>/<filename>` was
    inferred by mirroring the Confluence backup and has never been checked
    against a real Jira backup. Every lookup goes through here, so a wrong
    guess is a change to this one function. A path that does not exist is
    counted and skipped, never fatal, so a full run completes either way.
    """
    return backup.attachment_path(issue_key, filename)


class IssueAttachmentUploader:
    """Uploads an issue's backed-up Jira attachments as file assets.

    Idempotent on ``(external_source, external_id)``: a re-run reuses the
    existing asset instead of transferring the file again.
    """

    def __init__(self, workspace, project, backup, external_source, storage=None):
        self.workspace = workspace
        self.project = project
        self.backup = backup
        self.external_source = external_source
        self.storage = storage or S3Storage()
        self.missing = set()
        self.unsupported = set()

    def upload_for_issue(self, jira_issue, issue):
        """Returns filename -> ResolvedAttachment for the converter to use.

        Driven by what the issue record names rather than by what the directory
        holds, so a reference with no file behind it is visible as a miss.
        """
        resolved = {}
        for filename in jira_issue.attachments:
            path = attachment_source_path(self.backup, jira_issue.key, filename)
            if not path.is_file():
                self.missing.add(f"{jira_issue.key}/{filename}")
                continue
            attachment = self._upload(path, jira_issue.key, issue)
            if attachment is not None:
                resolved[filename] = attachment
        return resolved

    def _upload(self, path, issue_key, issue):
        content_type = mimetypes.guess_type(path.name)[0]
        if content_type not in settings.ATTACHMENT_MIME_TYPES:
            self.unsupported.add(path.name)
            return None

        external_id = f"{issue_key}/{path.name}"
        asset = FileAsset.objects.filter(
            workspace=self.workspace,
            external_source=self.external_source,
            external_id=external_id,
        ).first()

        if asset is None:
            asset = self._create(path, external_id, issue, content_type)
            if asset is None:
                return None

        return ResolvedAttachment(
            id=str(asset.id),
            filename=path.name,
            is_image=content_type.startswith("image/"),
            url=ATTACHMENT_URL_TEMPLATE.format(
                slug=self.workspace.slug, project=self.project.id, issue=issue.id, asset=asset.id
            ),
        )

    def _create(self, path, external_id, issue, content_type):
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
            issue=issue,
            created_by=issue.created_by,
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            external_source=self.external_source,
            external_id=external_id,
        )
