# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.app.serializers.issue_property import IssuePropertyOptionSerializer, IssuePropertySerializer
from plane.db.models.estimate import EstimateType


class BulkLabelSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, help_text="Migrated when omitted")
    description = serializers.CharField(required=False, allow_blank=True, help_text="Migrated Issue when omitted")


class BulkLabelsCreateSerializer(serializers.Serializer):
    label_data = BulkLabelSerializer(many=True, required=False, help_text="Labels with a taken name are skipped")


class IssuePropertyCreateSerializer(IssuePropertySerializer):
    options = IssuePropertyOptionSerializer(many=True, required=False, help_text="Only for option properties")


class EstimateDetailsSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, help_text="A random name when omitted")
    type = serializers.ChoiceField(choices=EstimateType.choices, required=False, help_text="categories when omitted")
    last_used = serializers.BooleanField(required=False, help_text="False when omitted")


class EstimatePointCreateSerializer(serializers.Serializer):
    key = serializers.IntegerField(min_value=0, required=False, help_text="0 when omitted")
    value = serializers.CharField(max_length=20, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)


class EstimateCreateSerializer(serializers.Serializer):
    estimate = EstimateDetailsSerializer()
    estimate_points = EstimatePointCreateSerializer(many=True)


class EstimateRenameSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    type = serializers.ChoiceField(choices=EstimateType.choices, required=False)


class EstimatePointUpdateSerializer(serializers.Serializer):
    id = serializers.UUIDField(help_text="Points of other estimates are ignored")
    key = serializers.IntegerField(min_value=0, required=False)
    value = serializers.CharField(max_length=20, required=False)


class EstimateUpdateSerializer(serializers.Serializer):
    partial_on_patch = False

    estimate = EstimateRenameSerializer(required=False)
    estimate_points = EstimatePointUpdateSerializer(many=True, min_length=1, help_text="A 400 when empty")


class EstimatePointCreateOneSerializer(serializers.Serializer):
    key = serializers.IntegerField(min_value=1, help_text="A 400 when missing or 0")
    value = serializers.CharField(max_length=255, help_text="A 400 when missing or blank")
