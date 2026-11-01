# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from plane.app.serializers import PageDetailSerializer
from plane.app.serializers.page import PageQuerySerializer


class PageWithIssuesSerializer(PageDetailSerializer):
    issue_ids = serializers.ListField(child=serializers.UUIDField(), help_text="Work items the page mentions")

    class Meta(PageDetailSerializer.Meta):
        fields = [*PageDetailSerializer.Meta.fields, "issue_ids"]


class PageSummarySerializer(serializers.Serializer):
    public_pages = serializers.IntegerField()
    private_pages = serializers.IntegerField()
    archived_pages = serializers.IntegerField()


class PageQueryRowSerializer(PageQuerySerializer):
    properties = serializers.DictField(child=serializers.CharField(), help_text="With kind=page-properties")
    property_colors = serializers.DictField(child=serializers.CharField(), help_text="With kind=page-properties")

    class Meta(PageQuerySerializer.Meta):
        fields = [*PageQuerySerializer.Meta.fields, "properties", "property_colors"]
        response_optional = ("properties", "property_colors")


class PageQueryLabelSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class PageQueryReportRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    value = serializers.CharField()
    is_complete = serializers.BooleanField()
    assignee_id = serializers.UUIDField(allow_null=True)
    due_date = serializers.DateField(allow_null=True)
    page_id = serializers.UUIDField()
    page_name = serializers.CharField()
    project_id = serializers.UUIDField(allow_null=True)


class PageQueryContributorSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    page_count = serializers.IntegerField()


class PageQueryPagesSerializer(serializers.Serializer):
    results = PageQueryRowSerializer(many=True)


class PageQueryLabelsSerializer(serializers.Serializer):
    results = PageQueryLabelSerializer(many=True)


class PageQueryReportSerializer(serializers.Serializer):
    results = PageQueryReportRowSerializer(many=True)


class PageQueryContributorsSerializer(serializers.Serializer):
    results = PageQueryContributorSerializer(many=True)


PageQueryResponse = PolymorphicProxySerializer(
    component_name="PageQueryResponse",
    serializers=[
        PageQueryPagesSerializer,
        PageQueryLabelsSerializer,
        PageQueryReportSerializer,
        PageQueryContributorsSerializer,
    ],
    resource_type_field_name=None,
    many=False,
    help_text="Rows depend on kind: pages, label-list, task-report or decision-report, contributors",
)


class PageMentionUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
