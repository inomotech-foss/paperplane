# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


def strings():
    return serializers.ListField(child=serializers.CharField())


class TriggerSerializer(serializers.Serializer):
    key = serializers.CharField()
    i18n_label = serializers.CharField()
    group = serializers.CharField()
    entity = serializers.CharField(allow_null=True)
    changed_field = serializers.CharField(allow_null=True)
    allowed_actions = strings()


class ConditionPropertySerializer(serializers.Serializer):
    key = serializers.CharField()
    i18n_label = serializers.CharField()
    kind = serializers.CharField()
    source = serializers.CharField(allow_null=True)
    operators = strings()


class MutablePropertySerializer(serializers.Serializer):
    key = serializers.CharField()
    i18n_label = serializers.CharField()
    kind = serializers.CharField()
    source = serializers.CharField(allow_null=True)
    change_types = strings()


class ActionTypeSerializer(serializers.Serializer):
    key = serializers.CharField()
    i18n_label = serializers.CharField()
    requires_entity = serializers.BooleanField()


class AutomationCatalogSerializer(serializers.Serializer):
    triggers = TriggerSerializer(many=True)
    condition_properties = ConditionPropertySerializer(many=True)
    mutable_properties = MutablePropertySerializer(many=True)
    actions = ActionTypeSerializer(many=True)
    notification_recipients = strings()
    template_variables = strings()
