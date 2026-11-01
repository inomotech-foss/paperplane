# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.utils.writing_assistant import ACTIONS, MAX_INSTRUCTION_LENGTH, MAX_TEXT_LENGTH, TONES


class WritingTaskSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ACTIONS)
    text = serializers.CharField(
        max_length=MAX_TEXT_LENGTH,
        help_text="The text to work on, as Markdown. For draft_description, the work item title.",
    )
    tone = serializers.ChoiceField(choices=TONES, required=False, help_text="Required for adjust_tone")
    instruction = serializers.CharField(
        max_length=MAX_INSTRUCTION_LENGTH, required=False, help_text="Required for custom"
    )

    def validate(self, attrs):
        if attrs["action"] == "adjust_tone" and not attrs.get("tone"):
            raise serializers.ValidationError({"tone": "This field is required for adjust_tone."})
        if attrs["action"] == "custom" and not attrs.get("instruction"):
            raise serializers.ValidationError({"instruction": "This field is required for custom."})
        return attrs
