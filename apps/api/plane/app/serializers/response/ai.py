# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

WRITING_ERROR_CODES = (
    "llm_not_configured",
    "provider_auth",
    "provider_rate_limit",
    "provider_model",
    "provider_error",
    "empty_response",
)


class WritingResultSerializer(serializers.Serializer):
    html = serializers.CharField(help_text="The result as sanitized HTML, ready to insert into the editor")


class WritingErrorSerializer(serializers.Serializer):
    error = serializers.CharField()
    code = serializers.ChoiceField(choices=WRITING_ERROR_CODES)
