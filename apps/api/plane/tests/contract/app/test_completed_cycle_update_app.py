# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""A completed cycle only takes a new sort order."""

from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import Cycle, ProjectMember
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import no_tasks  # noqa: F401


@pytest.fixture
def cycle(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="DONE")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    now = timezone.now()
    return Cycle.objects.create(
        name="Past",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=now - timedelta(days=20),
        end_date=now - timedelta(days=10),
    )


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestCompletedCycleUpdate:
    def url(self, cycle):
        return f"/api/workspaces/{cycle.workspace.slug}/projects/{cycle.project_id}/cycles/{cycle.id}/"

    def test_sort_order_drops_the_other_fields(self, session_client, cycle):
        response = session_client.patch(self.url(cycle), {"sort_order": 3, "name": "Renamed"}, format="json")
        assert response.status_code == 200
        cycle.refresh_from_db()
        assert (cycle.name, cycle.sort_order) == ("Past", 3)

    def test_other_fields_are_rejected(self, session_client, cycle):
        response = session_client.patch(self.url(cycle), {"name": "Renamed"}, format="json")
        assert response.status_code == 400
