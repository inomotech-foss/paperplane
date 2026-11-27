# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.utils.audit_fields import ReadOnlyAuditFieldsMixin


class BaseSerializer(ReadOnlyAuditFieldsMixin, serializers.ModelSerializer):
    id = serializers.PrimaryKeyRelatedField(read_only=True)
