# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers.request.ai import WritingTaskSerializer
from plane.app.serializers.response.ai import WritingErrorSerializer, WritingResultSerializer
from plane.throttles.writing_assistant import WritingAssistantThrottle
from plane.utils.llm import LLMError, complete, get_llm_config
from plane.utils.writing_assistant import build_messages, markdown_to_html

from ..base import BaseAPIView


class WritingAssistantEndpoint(BaseAPIView):
    throttle_classes = [WritingAssistantThrottle]

    @extend_schema(
        request=WritingTaskSerializer,
        responses={
            200: WritingResultSerializer,
            400: OpenApiResponse(description="Invalid action, missing tone or instruction, or text too long"),
            429: OpenApiResponse(description="Too many requests"),
            502: WritingErrorSerializer,
            503: WritingErrorSerializer,
        },
    )
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        serializer = WritingTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        config = get_llm_config()
        if not config:
            return Response(
                {"error": "No AI provider is configured", "code": "llm_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        messages = build_messages(data["action"], data["text"], data.get("tone"), data.get("instruction"))
        try:
            html = markdown_to_html(complete(config, messages))
        except LLMError as e:
            return Response({"error": e.message, "code": e.code}, status=status.HTTP_502_BAD_GATEWAY)
        if not html:
            return Response(
                {"error": "The AI provider returned no usable text", "code": "empty_response"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"html": html}, status=status.HTTP_200_OK)
