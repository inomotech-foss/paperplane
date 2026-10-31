# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.license.models import Instance
from plane.app.serializers import BaseSerializer
from plane.app.serializers import UserAdminLiteSerializer


class InstanceSerializer(BaseSerializer):
    primary_owner_details = UserAdminLiteSerializer(source="primary_owner", read_only=True)

    class Meta:
        model = Instance
        fields = "__all__"
        # Only the settings an admin edits are writable. The rest comes from setup and the version check.
        read_only_fields = [
            "id",
            "email",
            "last_checked_at",
            "is_setup_done",
            "instance_id",
            "current_version",
            "latest_version",
            "edition",
            "namespace",
            "is_signup_screen_visited",
            "is_verified",
            "is_test",
            "is_current_version_deprecated",
            "created_by",
            "updated_by",
            "deleted_at",
        ]
