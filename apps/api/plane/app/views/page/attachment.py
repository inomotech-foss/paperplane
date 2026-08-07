# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from django.conf import settings
from django.http import HttpResponseRedirect, StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectPagePermission
from plane.app.serializers import PageAttachmentSerializer
from plane.bgtasks.storage_metadata_task import get_asset_object_metadata
from plane.db.models import FileAsset, Workspace
from plane.settings.storage import S3Storage
from plane.utils.path_validator import sanitize_filename

from ..base import BaseAPIView

# Cap on proxied responses. Reading bytes through the app occupies a worker for
# the whole transfer, so anything large stays on the presigned-URL path.
MAX_PROXIED_SIZE = 10 * 1024 * 1024


def page_attachments(slug, project_id, page_id):
    return FileAsset.objects.filter(
        workspace__slug=slug,
        project_id=project_id,
        page_id=page_id,
        entity_type=FileAsset.EntityTypeContext.PAGE_ATTACHMENT,
    )


class PageAttachmentEndpoint(BaseAPIView):
    """Files attached to a page, as opposed to images embedded in its body.

    Same three-step flow as work-item attachments: POST reserves the asset and
    returns a presigned URL, the client PUTs the file straight to storage, then
    PATCH marks it uploaded.
    """

    serializer_class = PageAttachmentSerializer
    model = FileAsset
    permission_classes = [ProjectPagePermission]

    def _queryset(self, slug, project_id, page_id):
        return page_attachments(slug, project_id, page_id)

    def post(self, request, slug, project_id, page_id):
        name = sanitize_filename(request.data.get("name")) or "unnamed"
        file_type = request.data.get("type", False)
        size = int(request.data.get("size", settings.FILE_SIZE_LIMIT))

        if not file_type or file_type not in settings.ATTACHMENT_MIME_TYPES:
            return Response(
                {"error": "Invalid file type.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace = Workspace.objects.get(slug=slug)
        size_limit = min(size, settings.FILE_SIZE_LIMIT)
        asset_key = f"{workspace.id}/{uuid.uuid4().hex}-{name}"

        asset = FileAsset.objects.create(
            attributes={"name": name, "type": file_type, "size": size_limit},
            asset=asset_key,
            size=size_limit,
            workspace_id=workspace.id,
            created_by=request.user,
            page_id=page_id,
            project_id=project_id,
            entity_type=FileAsset.EntityTypeContext.PAGE_ATTACHMENT,
        )

        storage = S3Storage(request=request)
        presigned_url = storage.generate_presigned_post(
            object_name=asset_key, file_type=file_type, file_size=size_limit
        )

        return Response(
            {
                "upload_data": presigned_url,
                "asset_id": str(asset.id),
                "attachment": PageAttachmentSerializer(asset).data,
                "asset_url": asset.asset_url,
            },
            status=status.HTTP_200_OK,
        )

    def get(self, request, slug, project_id, page_id, pk=None):
        if pk:
            asset = self._queryset(slug, project_id, page_id).filter(pk=pk).first()
            if asset is None:
                return Response({"error": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)
            if not asset.is_uploaded:
                return Response(
                    {"error": "The asset is not uploaded.", "status": False},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            storage = S3Storage(request=request)
            return HttpResponseRedirect(
                storage.generate_presigned_url(
                    object_name=asset.asset.name,
                    disposition="attachment",
                    filename=asset.attributes.get("name"),
                )
            )

        attachments = self._queryset(slug, project_id, page_id).filter(is_uploaded=True)
        return Response(PageAttachmentSerializer(attachments, many=True).data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, page_id, pk):
        asset = self._queryset(slug, project_id, page_id).filter(pk=pk).first()
        if asset is None:
            return Response({"error": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        # UPDATE rather than save(): created_by belongs to whoever created the
        # asset and must never be reassigned here (GHSA-5mxw-g5mw-3v3w), and
        # BaseModel.save() rewrites the audit fields from the current user.
        FileAsset.objects.filter(pk=asset.pk).update(is_uploaded=True)
        if not asset.storage_metadata:
            get_asset_object_metadata.delay(str(asset.id))
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, slug, project_id, page_id, pk):
        asset = self._queryset(slug, project_id, page_id).filter(pk=pk).first()
        if asset is None:
            return Response({"error": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        FileAsset.objects.filter(pk=asset.pk).update(is_deleted=True, deleted_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageAttachmentContentEndpoint(BaseAPIView):
    """Streams an attachment's bytes from the app's own origin.

    The download route redirects to a presigned storage URL, which browser code
    cannot read unless the bucket is configured for CORS. Editor blocks that have
    to read the file they render - the diagram block reads the `.drawio` XML it
    hands to the editing iframe - read it here instead, so nothing about the
    deployment's object store has to change.
    """

    permission_classes = [ProjectPagePermission]

    def get(self, request, slug, project_id, page_id, pk):
        asset = page_attachments(slug, project_id, page_id).filter(pk=pk).first()
        if asset is None:
            return Response({"error": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)
        if not asset.is_uploaded:
            return Response(
                {"error": "The asset is not uploaded.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (asset.size or 0) > MAX_PROXIED_SIZE:
            return Response(
                {"error": "The asset is too large to read inline.", "status": False},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        stored = S3Storage(request=request).get_object(asset.asset.name)
        if stored is None:
            return Response({"error": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        response = StreamingHttpResponse(
            stored["Body"].iter_chunks(),
            content_type=asset.attributes.get("type") or "application/octet-stream",
        )
        # This is the app's own origin, so an uploaded SVG or XML file must never
        # be rendered as a document here. Neither header affects fetch(), which is
        # the only thing meant to call this route; the filename is left off so no
        # user-supplied text reaches a response header at all.
        response["Content-Disposition"] = "attachment"
        response["X-Content-Type-Options"] = "nosniff"
        return response
