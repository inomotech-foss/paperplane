# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Page, PageApproval, PageApprovalEvent, Project, ProjectPage, User, Workspace
from plane.maintenance.upgrade import JsonValue
from plane.maintenance.upgrades import UPGRADES, backfill_task_creators
from plane.utils import page_approval

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


def _run() -> None:
    cursor: JsonValue = None
    while True:
        cursor = backfill_task_creators.UPGRADE.step(cursor).cursor
        if cursor is None:
            return


def test_is_registered_last():
    assert UPGRADES[-1] is backfill_task_creators.UPGRADE


def test_fills_the_creators_a_background_baseline_left_empty(workspace: Workspace, create_user: User):
    project = Project.objects.create(
        name="Approvals", identifier="APR", workspace=workspace, is_page_approval_enabled=True
    )
    page = Page.objects.create(name="Policy", workspace=workspace, owned_by=create_user)
    ProjectPage.objects.create(project=project, page=page, workspace=workspace)
    page_approval.baseline(page, project.id, create_user)
    PageApproval.all_objects.filter(page=page).update(created_by=None)
    PageApprovalEvent.all_objects.filter(page=page).update(created_by=None)

    _run()

    assert set(PageApproval.all_objects.filter(page=page).values_list("created_by_id", flat=True)) == {create_user.id}
    assert set(PageApprovalEvent.all_objects.filter(page=page).values_list("created_by_id", flat=True)) == {
        create_user.id
    }
