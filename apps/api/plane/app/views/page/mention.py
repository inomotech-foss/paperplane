# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from bs4 import BeautifulSoup
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectPagePermission
from plane.app.serializers.response.page import PageMentionUserSerializer
from plane.db.models import Page, User, WorkspaceMember

from ..base import BaseAPIView


def mentioned_user_ids(description_html):
    ids = set()
    if not description_html:
        return ids
    soup = BeautifulSoup(description_html, "html.parser")
    for mention in soup.find_all("mention-component", attrs={"entity_name": "user_mention"}):
        try:
            ids.add(uuid.UUID(str(mention.get("entity_identifier"))))
        except ValueError:
            continue
    return ids


class PageMentionEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @extend_schema(responses={200: PageMentionUserSerializer(many=True)})
    def get(self, request, slug, project_id, page_id):
        page = Page.objects.get(
            pk=page_id,
            workspace__slug=slug,
            projects__id=project_id,
            project_pages__deleted_at__isnull=True,
        )
        members = WorkspaceMember.objects.filter(workspace_id=page.workspace_id, is_active=True).values("member_id")
        users = User.objects.filter(pk__in=mentioned_user_ids(page.description_html)).filter(pk__in=members)
        return Response(PageMentionUserSerializer(users, many=True).data, status=status.HTTP_200_OK)
