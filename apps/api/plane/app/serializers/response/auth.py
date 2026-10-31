# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from .user import ConnectedAppWorkspaceSerializer


class EmailCheckSerializer(serializers.Serializer):
    existing = serializers.BooleanField()
    status = serializers.CharField(help_text="MAGIC_CODE or CREDENTIAL")


class MagicKeySerializer(serializers.Serializer):
    key = serializers.CharField()


class CSRFTokenSerializer(serializers.Serializer):
    csrf_token = serializers.CharField()


class AppInstallationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    application = serializers.CharField(help_text="OAuth application id")
    workspace_detail = ConnectedAppWorkspaceSerializer()
