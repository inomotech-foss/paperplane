# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectPagePermission
from plane.app.serializers import UserLiteSerializer
from plane.bgtasks.page_transaction_task import extract_all_components
from plane.db.models import Page, User

from ..base import BaseAPIView


def mentioned_user_ids(description_html):
    ids = set()
    for mention in extract_all_components(description_html)["mention-component"]:
        if mention.get("entity_name") != "user_mention":
            continue
        try:
            ids.add(uuid.UUID(str(mention.get("entity_identifier"))))
        except ValueError:
            continue
    return ids


class PageMentionEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @extend_schema(responses={200: UserLiteSerializer(many=True)})
    def get(self, request, slug, project_id, page_id):
        page = Page.objects.get(
            pk=page_id,
            workspace__slug=slug,
            projects__id=project_id,
            project_pages__deleted_at__isnull=True,
        )
        users = User.objects.filter(
            pk__in=mentioned_user_ids(page.description_html),
            member_workspace__workspace_id=page.workspace_id,
        ).distinct()
        return Response(UserLiteSerializer(users, many=True).data, status=status.HTTP_200_OK)
