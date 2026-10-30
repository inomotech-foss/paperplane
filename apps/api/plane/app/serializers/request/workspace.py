# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.app.serializers.workspace import WorkSpaceSerializer
from plane.db.models.workspace import ROLE_CHOICES


class WorkspaceInviteEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=ROLE_CHOICES, required=False, help_text="Guest when omitted")


class WorkspaceInviteSerializer(serializers.Serializer):
    emails = serializers.ListField(child=WorkspaceInviteEmailSerializer())


class WorkspaceInvitationsJoinSerializer(serializers.Serializer):
    invitations = serializers.ListField(child=serializers.UUIDField(), help_text="Invitation ids to accept")


class WorkspaceJoinSerializer(serializers.Serializer):
    token = serializers.CharField(help_text="The token from the invitation email")
    accepted = serializers.BooleanField(required=False, help_text="False when omitted, which declines")


class RoleUpdateSerializer(serializers.Serializer):
    """The only key the endpoint accepts."""

    partial_on_patch = False

    role = serializers.ChoiceField(choices=ROLE_CHOICES)


class WorkspaceMemberViewPropsSerializer(serializers.Serializer):
    view_props = serializers.JSONField(required=False, help_text="An empty object when omitted")


class WorkspaceSidebarPreferenceUpdateSerializer(serializers.Serializer):
    key = serializers.CharField(help_text="Items without a known key are skipped")
    is_pinned = serializers.BooleanField(required=False)
    sort_order = serializers.FloatField(required=False)


class WorkspaceCreateSerializer(WorkSpaceSerializer):
    company_role = serializers.CharField(
        required=False, allow_blank=True, write_only=True, help_text="Stored on the creator's membership"
    )

    class Meta(WorkSpaceSerializer.Meta):
        pass


class NotificationSnoozeSerializer(serializers.Serializer):
    """The only key the endpoint reads."""

    snoozed_till = serializers.DateTimeField(required=False, allow_null=True, help_text="Null when omitted")


class NotificationMarkAllReadSerializer(serializers.Serializer):
    snoozed = serializers.BooleanField(required=False, help_text="Only snoozed notifications when true")
    archived = serializers.BooleanField(required=False, help_text="Only archived notifications when true")
    type = serializers.CharField(
        required=False, help_text="watching, assigned or created narrows the set, anything else marks all"
    )
