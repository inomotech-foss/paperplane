# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class AssistantTaskSerializer(serializers.Serializer):
    task = serializers.CharField(help_text="What the assistant should do")
    prompt = serializers.CharField(required=False, allow_blank=True, help_text="The text the task works on")
