# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class ApiTokenCreateSerializer(serializers.Serializer):
    label = serializers.CharField(required=False, help_text="A random hex string when omitted")
    description = serializers.CharField(required=False, allow_blank=True)
    expired_at = serializers.DateTimeField(required=False, allow_null=True)


class UserOnboardedSerializer(serializers.Serializer):
    is_onboarded = serializers.BooleanField(required=False, help_text="False when omitted")


class UserTourCompletedSerializer(serializers.Serializer):
    is_tour_completed = serializers.BooleanField(required=False, help_text="False when omitted")


class EmailVerificationCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="The new email address")


class EmailUpdateSerializer(serializers.Serializer):
    partial_on_patch = False

    email = serializers.EmailField(help_text="The new email address")
    code = serializers.CharField(help_text="The code sent to the new address")


class UserActivityExportSerializer(serializers.Serializer):
    date = serializers.DateField(help_text="Export the activity of this day")


class ProjectJoinSerializer(serializers.Serializer):
    project_ids = serializers.ListField(child=serializers.UUIDField())


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=False, help_text="Required unless the password was autoset")
    new_password = serializers.CharField()


class AuthEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(help_text="Must pass the password strength check")
