# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.bgtasks.data_upgrade_task import run_data_upgrades
from plane.db.models import DataUpgradeState
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.api.serializers.response import DataUpgradeSerializer
from plane.maintenance import runner, upgrades
from plane.maintenance.upgrade import DataUpgrade

from .base import BaseAPIView


def serialize(upgrade: DataUpgrade, state: DataUpgradeState | None) -> dict[str, object]:
    return {
        "name": upgrade.name,
        "description": upgrade.description,
        "status": state.status if state else DataUpgradeState.Status.PENDING,
        "counts": state.counts if state else {},
        "error": state.error if state else "",
        "attempts": state.attempts if state else 0,
        "started_at": state.started_at if state else None,
        "finished_at": state.finished_at if state else None,
        "updated_at": state.updated_at if state else None,
    }


def registered(name: str) -> DataUpgrade | None:
    return next((upgrade for upgrade in upgrades.UPGRADES if upgrade.name == name), None)


class InstanceDataUpgradeEndpoint(BaseAPIView):
    """The registered data upgrades in the order they run, with their progress."""

    permission_classes = [InstanceAdminPermission]

    @extend_schema(filters=False, responses={200: DataUpgradeSerializer(many=True)})
    def get(self, request):
        states = {state.name: state for state in DataUpgradeState.objects.all()}
        body = [serialize(upgrade, states.get(upgrade.name)) for upgrade in upgrades.UPGRADES]
        return Response(DataUpgradeSerializer(body, many=True).data, status=status.HTTP_200_OK)


class InstanceDataUpgradeRetryEndpoint(BaseAPIView):
    """Runs a failed upgrade again from the batch it failed on."""

    permission_classes = [InstanceAdminPermission]

    @extend_schema(request=None, responses={200: DataUpgradeSerializer})
    def post(self, request, name):
        upgrade = registered(name)
        if upgrade is None:
            return Response({"error": "No such data upgrade"}, status=status.HTTP_404_NOT_FOUND)
        if not runner.retry(name):
            return Response({"error": "Only a failed data upgrade can be retried"}, status=status.HTTP_409_CONFLICT)
        run_data_upgrades.delay()
        state = DataUpgradeState.objects.get(name=name)
        return Response(DataUpgradeSerializer(serialize(upgrade, state)).data, status=status.HTTP_200_OK)
