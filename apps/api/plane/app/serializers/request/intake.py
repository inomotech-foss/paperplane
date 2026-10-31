# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.app.serializers.issue import IssueCreateSerializer
from plane.db.models.intake import IntakeIssueStatus
from plane.db.models.service_desk import ServiceDeskNotifyMode
from plane.utils.order_queryset import INTAKE_ISSUE_ORDER_BY_ALLOWLIST


class IntakeIssueCreateSerializer(serializers.Serializer):
    issue = IssueCreateSerializer(help_text="The work item. Its state is always the triage state")


class IntakeIssueUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=IntakeIssueStatus.choices, required=False, help_text="Admins only")
    duplicate_to = serializers.UUIDField(required=False, allow_null=True, help_text="Admins only")
    snoozed_till = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Admins only. A YYYY-MM-DD day is read as the start of that day in the project timezone",
    )
    issue = IssueCreateSerializer(
        required=False, partial=True, help_text="Guests may change only the name and the description"
    )
    skip_activity = serializers.BooleanField(
        required=False, help_text="With description_html, records no activity for a description migration"
    )


def _query(name, description, type=OpenApiTypes.STR, enum=None):
    return OpenApiParameter(name=name, type=type, location=OpenApiParameter.QUERY, description=description, enum=enum)


_ORDER_BY = sorted(INTAKE_ISSUE_ORDER_BY_ALLOWLIST | {f"-{field}" for field in INTAKE_ISSUE_ORDER_BY_ALLOWLIST})

INTAKE_ISSUE_LIST_PARAMETERS = [
    _query("status", "Comma separated intake statuses, -2 (pending) when omitted"),
    _query("state", "Comma separated state ids"),
    _query("priority", "Comma separated priorities"),
    _query("labels", "Comma separated label ids"),
    _query("assignees", "Comma separated user ids"),
    _query("created_by", "Comma separated user ids"),
    _query("created_at", "Comma separated date filters, such as 2026-01-01;after or 1_weeks;before;fromnow"),
    _query("updated_at", "Comma separated date filters, such as 2026-01-01;after or 1_weeks;before;fromnow"),
    _query("order_by", "-issue__created_at when omitted", enum=_ORDER_BY),
    _query("cursor", "Pagination cursor, per_page:page:offset"),
    _query("per_page", "Results per page", type=OpenApiTypes.INT),
]


class ServiceDeskConfigUpdateSerializer(serializers.Serializer):
    mailbox_email = serializers.EmailField(
        required=False, allow_blank=True, help_text="Empty when omitted. Required to enable the service desk"
    )
    is_enabled = serializers.BooleanField(required=False, help_text="False when omitted")
    issue_type_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="The type of the work items created from mail. Required to enable. Kept when omitted",
    )
    notify_mode = serializers.ChoiceField(
        choices=ServiceDeskNotifyMode.choices, required=False, help_text="Kept when omitted, NONE on create"
    )
    notify_user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        help_text="With notify_mode CUSTOM. Ids that are not active project members are dropped",
    )


class IssueEmailThreadUpdateSerializer(serializers.Serializer):
    to_emails = serializers.ListField(child=serializers.EmailField(), required=False)
    cc_emails = serializers.ListField(child=serializers.EmailField(), required=False)


class IssueEmailReplySerializer(serializers.Serializer):
    comment_html = serializers.CharField(required=False, help_text="Required unless attachments are sent")
    attachment_asset_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        help_text="Uploaded attachments of the work item to send with the reply",
    )
