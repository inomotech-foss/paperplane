# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Dashboards of PQL widgets, see `plane.db.models.dashboard`."""

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, WorkspaceEntityPermission, allow_permission
from plane.app.serializers import DashboardSerializer, DashboardWidgetSerializer
from plane.db.models import (
    Dashboard,
    DashboardWidget,
    IssueProperty,
    IssueType,
    PropertyTypeChoices,
    Workspace,
    WorkspaceMember,
)
from plane.utils.dashboard_widgets import (
    CHART_TYPES,
    DATE_BUCKETS,
    DATE_DIMENSIONS,
    METRIC_FUNCTIONS,
    NATIVE_DIMENSIONS,
    WidgetDefinitionError,
    evaluate_widget,
    validate_widget_definition,
)

from .base import BaseAPIView, BaseViewSet

PUBLIC = 1


def visible_dashboards(user, slug):
    """Public dashboards of the workspace plus the caller's private ones."""
    return (
        Dashboard.objects.filter(workspace__slug=slug)
        .filter(Q(access=PUBLIC) | Q(owned_by=user))
        .annotate(widget_count=Count("widgets", filter=Q(widgets__deleted_at__isnull=True)))
        .select_related("workspace")
    )


def can_edit(dashboard, user, slug):
    """The owner and workspace admins may change a dashboard."""
    if dashboard.owned_by_id == user.id:
        return True
    return WorkspaceMember.objects.filter(
        workspace__slug=slug, member=user, role=ROLE.ADMIN.value, is_active=True
    ).exists()


def forbidden():
    return Response({"error": "Only the owner or a workspace admin can change this dashboard"}, status=403)


class DashboardViewSet(BaseViewSet):
    model = Dashboard
    serializer_class = DashboardSerializer
    permission_classes = [WorkspaceEntityPermission]

    def get_queryset(self):
        return visible_dashboards(self.request.user, self.kwargs.get("slug"))

    def list(self, request, slug):
        serializer = DashboardSerializer(self.get_queryset(), many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, slug, pk):
        dashboard = self.get_queryset().get(pk=pk)
        data = DashboardSerializer(dashboard, context={"request": request}).data
        data["widgets"] = DashboardWidgetSerializer(
            dashboard.widgets.all(), many=True, context={"slug": slug, "request": request}
        ).data
        return Response(data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = DashboardSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        dashboard = serializer.save(workspace=workspace, owned_by=request.user)
        dashboard = self.get_queryset().get(pk=dashboard.pk)
        return Response(DashboardSerializer(dashboard, context={"request": request}).data, status=201)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        dashboard = self.get_queryset().get(pk=pk)
        if not can_edit(dashboard, request.user, slug):
            return forbidden()
        serializer = DashboardSerializer(dashboard, data=request.data, partial=True, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        dashboard = self.get_queryset().get(pk=pk)
        return Response(DashboardSerializer(dashboard, context={"request": request}).data, status=200)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        dashboard = self.get_queryset().get(pk=pk)
        if not can_edit(dashboard, request.user, slug):
            return forbidden()
        dashboard.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardWidgetViewSet(BaseViewSet):
    model = DashboardWidget
    serializer_class = DashboardWidgetSerializer
    permission_classes = [WorkspaceEntityPermission]

    def dashboard(self):
        return visible_dashboards(self.request.user, self.kwargs.get("slug")).get(pk=self.kwargs.get("dashboard_id"))

    def get_queryset(self):
        return DashboardWidget.objects.filter(
            workspace__slug=self.kwargs.get("slug"), dashboard_id=self.kwargs.get("dashboard_id")
        )

    def context(self, slug):
        return {"slug": slug, "request": self.request}

    def list(self, request, slug, dashboard_id):
        self.dashboard()
        serializer = DashboardWidgetSerializer(self.get_queryset(), many=True, context=self.context(slug))
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, slug, dashboard_id, pk):
        self.dashboard()
        widget = self.get_queryset().get(pk=pk)
        return Response(DashboardWidgetSerializer(widget, context=self.context(slug)).data, status=200)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug, dashboard_id):
        dashboard = self.dashboard()
        if not can_edit(dashboard, request.user, slug):
            return forbidden()
        serializer = DashboardWidgetSerializer(data=request.data, context=self.context(slug))
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(dashboard=dashboard, workspace_id=dashboard.workspace_id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def partial_update(self, request, slug, dashboard_id, pk):
        dashboard = self.dashboard()
        if not can_edit(dashboard, request.user, slug):
            return forbidden()
        widget = self.get_queryset().get(pk=pk)
        serializer = DashboardWidgetSerializer(widget, data=request.data, partial=True, context=self.context(slug))
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def destroy(self, request, slug, dashboard_id, pk):
        dashboard = self.dashboard()
        if not can_edit(dashboard, request.user, slug):
            return forbidden()
        self.get_queryset().get(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardWidgetDataEndpoint(BaseAPIView):
    """The chart data of a saved widget, evaluated for the caller."""

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug, dashboard_id, pk):
        visible_dashboards(request.user, slug).get(pk=dashboard_id)
        widget = DashboardWidget.objects.get(workspace__slug=slug, dashboard_id=dashboard_id, pk=pk)
        definition = {
            "chart_type": widget.chart_type,
            "query": widget.query,
            "metric": widget.metric,
            "dimension": widget.dimension,
            "series": widget.series,
        }
        try:
            return Response(evaluate_widget(definition, request.user, slug), status=status.HTTP_200_OK)
        except WidgetDefinitionError as exc:
            return Response(exc.as_dict(), status=status.HTTP_400_BAD_REQUEST)


class DashboardWidgetPreviewEndpoint(BaseAPIView):
    """Evaluate an unsaved widget definition, for the editor's live preview."""

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def post(self, request, slug):
        try:
            definition = validate_widget_definition(request.data, slug)
            return Response(evaluate_widget(definition, request.user, slug), status=status.HTTP_200_OK)
        except WidgetDefinitionError as exc:
            return Response(exc.as_dict(), status=status.HTTP_400_BAD_REQUEST)


class DashboardOptionsEndpoint(BaseAPIView):
    """What a widget may measure and split by in this workspace."""

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        properties = [
            {
                "id": str(prop.id),
                "name": prop.display_name,
                "property_type": prop.property_type,
                "is_multi": prop.is_multi,
                "project_id": str(prop.project_id),
                "project_name": prop.project.name,
                "issue_type_id": str(prop.issue_type_id) if prop.issue_type_id else None,
            }
            for prop in IssueProperty.objects.filter(
                workspace__slug=slug,
                is_active=True,
                project__project_projectmember__member=request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("project")
            .distinct()
            .order_by("project__name", "sort_order")
        ]
        types = [
            {"id": str(issue_type.id), "name": issue_type.name, "logo_props": issue_type.logo_props}
            for issue_type in IssueType.objects.filter(workspace__slug=slug, is_active=True).order_by("name")
        ]
        return Response(
            {
                "chart_types": list(CHART_TYPES),
                "metric_functions": list(METRIC_FUNCTIONS),
                "date_buckets": list(DATE_BUCKETS),
                "native_dimensions": list(NATIVE_DIMENSIONS),
                "date_dimensions": list(DATE_DIMENSIONS),
                "types": types,
                "properties": properties,
                "metric_properties": [
                    prop for prop in properties if prop["property_type"] == PropertyTypeChoices.DECIMAL
                ],
            },
            status=status.HTTP_200_OK,
        )
