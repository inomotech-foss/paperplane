# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class ModuleFavoriteSerializer(serializers.Serializer):
    module = serializers.UUIDField()


class ModuleIssuesAddSerializer(serializers.Serializer):
    issues = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, help_text="Work items of the project"
    )


class IssueModulesUpdateSerializer(serializers.Serializer):
    modules = serializers.ListField(
        child=serializers.UUIDField(), required=False, help_text="Modules of the project to add the work item to"
    )
    removed_modules = serializers.ListField(
        child=serializers.UUIDField(), required=False, help_text="Modules to remove the work item from"
    )
