# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction
from django.db.models import Prefetch

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import (
    AutomationActionSerializer,
    AutomationRunSerializer,
    AutomationSerializer,
)
from plane.automation.registry import TriggerType, serialize_catalog
from plane.bgtasks.automation_task import reschedule, run_automation_now
from plane.db.models import (
    Automation,
    AutomationAction,
    AutomationProject,
    AutomationRun,
    AutomationScope,
    Project,
    Workspace,
)
from ..base import BaseAPIView


class AutomationBaseEndpoint(BaseAPIView):
    """
    Shared CRUD for automations. Subclasses set ``scope`` and apply the
    permission level that matches their URL.

    Project scoped automations live under a project and are pinned to it.
    Workspace scoped ones live under the workspace and fan out to either every
    project or an explicit list.
    """

    scope = AutomationScope.PROJECT

    def get_queryset(self, slug, project_id=None):
        queryset = (
            Automation.objects.filter(workspace__slug=slug, scope=self.scope)
            .select_related("workspace", "project", "owned_by")
            .prefetch_related(
                Prefetch("actions", queryset=AutomationAction.objects.order_by("sort_order")),
                "automation_projects",
            )
        )
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    # -- reads -----------------------------------------------------------

    def list_automations(self, request, slug, project_id=None):
        automations = self.get_queryset(slug, project_id)
        serializer = AutomationSerializer(automations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve_automation(self, request, slug, pk, project_id=None):
        automation = self.get_queryset(slug, project_id).filter(pk=pk).first()
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AutomationSerializer(automation).data, status=status.HTTP_200_OK)

    # -- writes ----------------------------------------------------------

    def _sync_projects(self, automation, project_ids):
        """Replace the project selection of a workspace scoped automation."""
        valid_ids = set(
            str(pk)
            for pk in Project.objects.filter(workspace_id=automation.workspace_id, pk__in=project_ids).values_list(
                "id", flat=True
            )
        )
        AutomationProject.objects.filter(automation=automation).exclude(project_id__in=valid_ids).delete(soft=False)
        existing = set(
            str(pk)
            for pk in AutomationProject.objects.filter(automation=automation).values_list("project_id", flat=True)
        )
        AutomationProject.objects.bulk_create(
            [
                AutomationProject(
                    automation=automation,
                    project_id=project_id,
                    workspace_id=automation.workspace_id,
                )
                for project_id in valid_ids - existing
            ],
            batch_size=100,
            ignore_conflicts=True,
        )

    def create_automation(self, request, slug, project_id=None):
        workspace = Workspace.objects.filter(slug=slug).first()
        if workspace is None:
            return Response({"error": "Workspace not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AutomationSerializer(data=request.data, context={"scope": self.scope})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project_ids = serializer.validated_data.pop("project_ids", [])
        with transaction.atomic():
            automation = serializer.save(
                workspace_id=workspace.id,
                project_id=project_id,
                scope=self.scope,
                owned_by=request.user,
            )
            if self.scope == AutomationScope.WORKSPACE and not automation.applies_to_all_projects:
                self._sync_projects(automation, project_ids)

        automation.refresh_from_db()
        return Response(AutomationSerializer(automation).data, status=status.HTTP_201_CREATED)

    def update_automation(self, request, slug, pk, project_id=None):
        automation = self.get_queryset(slug, project_id).filter(pk=pk).first()
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AutomationSerializer(automation, data=request.data, partial=True, context={"scope": self.scope})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project_ids = serializer.validated_data.pop("project_ids", None)
        was_enabled = automation.is_enabled
        previous_trigger_config = automation.trigger_config

        with transaction.atomic():
            automation = serializer.save()
            if self.scope == AutomationScope.WORKSPACE:
                if automation.applies_to_all_projects:
                    AutomationProject.objects.filter(automation=automation).delete(soft=False)
                elif project_ids is not None:
                    self._sync_projects(automation, project_ids)

            # Keep the scheduler cursor in step with the saved schedule.
            if automation.trigger_type == TriggerType.SCHEDULE:
                schedule_changed = automation.trigger_config != previous_trigger_config
                if not automation.is_enabled:
                    if automation.next_run_at is not None:
                        automation.next_run_at = None
                        automation.save(update_fields=["next_run_at", "updated_at"], disable_auto_set_user=True)
                elif schedule_changed or not was_enabled or automation.next_run_at is None:
                    reschedule(automation)

        automation.refresh_from_db()
        return Response(AutomationSerializer(automation).data, status=status.HTTP_200_OK)

    def destroy_automation(self, request, slug, pk, project_id=None):
        automation = self.get_queryset(slug, project_id).filter(pk=pk).first()
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)
        if automation.is_enabled:
            return Response(
                {"error": "Disable the automation before deleting it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        automation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- actions ---------------------------------------------------------

    def _get_automation(self, slug, automation_id, project_id=None):
        return self.get_queryset(slug, project_id).filter(pk=automation_id).first()

    def list_actions(self, request, slug, automation_id, project_id=None):
        automation = self._get_automation(slug, automation_id, project_id)
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AutomationActionSerializer(automation.actions.all().order_by("sort_order"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create_action(self, request, slug, automation_id, project_id=None):
        automation = self._get_automation(slug, automation_id, project_id)
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AutomationActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Append to the end unless the caller placed it explicitly.
        if serializer.validated_data.get("sort_order") is None:
            last = automation.actions.order_by("-sort_order").values_list("sort_order", flat=True).first()
            serializer.validated_data["sort_order"] = (last or 0) + 10000

        action = serializer.save(automation=automation, workspace_id=automation.workspace_id)
        return Response(AutomationActionSerializer(action).data, status=status.HTTP_201_CREATED)

    def update_action(self, request, slug, automation_id, pk, project_id=None):
        automation = self._get_automation(slug, automation_id, project_id)
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)

        action = automation.actions.filter(pk=pk).first()
        if action is None:
            return Response({"error": "Action not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AutomationActionSerializer(action, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy_action(self, request, slug, automation_id, pk, project_id=None):
        automation = self._get_automation(slug, automation_id, project_id)
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)

        action = automation.actions.filter(pk=pk).first()
        if action is None:
            return Response({"error": "Action not found."}, status=status.HTTP_404_NOT_FOUND)

        # An enabled automation with no actions would run and do nothing.
        if automation.is_enabled and automation.actions.count() == 1:
            return Response(
                {"error": "Disable the automation before deleting its only action."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- runs ------------------------------------------------------------

    def list_runs(self, request, slug, automation_id, project_id=None):
        automation = self._get_automation(slug, automation_id, project_id)
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)

        runs = AutomationRun.objects.filter(automation=automation).order_by("-started_at")
        run_status = request.query_params.get("status")
        if run_status:
            runs = runs.filter(status=run_status)

        return self.paginate(
            request=request,
            queryset=runs,
            on_results=lambda results: AutomationRunSerializer(results, many=True).data,
        )

    def trigger_run(self, request, slug, automation_id, project_id=None):
        automation = self._get_automation(slug, automation_id, project_id)
        if automation is None:
            return Response({"error": "Automation not found."}, status=status.HTTP_404_NOT_FOUND)
        if not automation.is_enabled:
            return Response(
                {"error": "Enable the automation before running it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        run_automation_now.delay(str(automation.id), str(request.user.id))
        return Response({"message": "The automation has been queued."}, status=status.HTTP_202_ACCEPTED)


class ProjectAutomationEndpoint(AutomationBaseEndpoint):
    scope = AutomationScope.PROJECT

    @allow_permission([ROLE.ADMIN])
    def get(self, request, slug, project_id, pk=None):
        if pk is None:
            return self.list_automations(request, slug, project_id=project_id)
        return self.retrieve_automation(request, slug, pk, project_id=project_id)

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        return self.create_automation(request, slug, project_id=project_id)

    @allow_permission([ROLE.ADMIN])
    def patch(self, request, slug, project_id, pk):
        return self.update_automation(request, slug, pk, project_id=project_id)

    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id, pk):
        return self.destroy_automation(request, slug, pk, project_id=project_id)


class ProjectAutomationActionEndpoint(AutomationBaseEndpoint):
    scope = AutomationScope.PROJECT

    @allow_permission([ROLE.ADMIN])
    def get(self, request, slug, project_id, automation_id):
        return self.list_actions(request, slug, automation_id, project_id=project_id)

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id, automation_id):
        return self.create_action(request, slug, automation_id, project_id=project_id)

    @allow_permission([ROLE.ADMIN])
    def patch(self, request, slug, project_id, automation_id, pk):
        return self.update_action(request, slug, automation_id, pk, project_id=project_id)

    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id, automation_id, pk):
        return self.destroy_action(request, slug, automation_id, pk, project_id=project_id)


class ProjectAutomationRunEndpoint(AutomationBaseEndpoint):
    scope = AutomationScope.PROJECT

    @allow_permission([ROLE.ADMIN])
    def get(self, request, slug, project_id, automation_id):
        return self.list_runs(request, slug, automation_id, project_id=project_id)

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id, automation_id):
        return self.trigger_run(request, slug, automation_id, project_id=project_id)


class WorkspaceAutomationEndpoint(AutomationBaseEndpoint):
    scope = AutomationScope.WORKSPACE

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug, pk=None):
        if pk is None:
            return self.list_automations(request, slug)
        return self.retrieve_automation(request, slug, pk)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug):
        return self.create_automation(request, slug)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def patch(self, request, slug, pk):
        return self.update_automation(request, slug, pk)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def delete(self, request, slug, pk):
        return self.destroy_automation(request, slug, pk)


class WorkspaceAutomationActionEndpoint(AutomationBaseEndpoint):
    scope = AutomationScope.WORKSPACE

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug, automation_id):
        return self.list_actions(request, slug, automation_id)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug, automation_id):
        return self.create_action(request, slug, automation_id)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def patch(self, request, slug, automation_id, pk):
        return self.update_action(request, slug, automation_id, pk)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def delete(self, request, slug, automation_id, pk):
        return self.destroy_action(request, slug, automation_id, pk)


class WorkspaceAutomationRunEndpoint(AutomationBaseEndpoint):
    scope = AutomationScope.WORKSPACE

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug, automation_id):
        return self.list_runs(request, slug, automation_id)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug, automation_id):
        return self.trigger_run(request, slug, automation_id)


class AutomationMetadataEndpoint(BaseAPIView):
    """
    The trigger, condition and action vocabulary the designer renders from.

    Static per deployment, so the client can cache it for the session.
    """

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        return Response(serialize_catalog(), status=status.HTTP_200_OK)
