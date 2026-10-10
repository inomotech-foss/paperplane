# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.utils import timezone

from plane.bgtasks.deletion_task import soft_delete_related_objects
from plane.db.models import Issue, IssueType, Project


@pytest.mark.unit
@pytest.mark.django_db
def test_soft_deleting_a_type_leaves_its_work_items_alone(workspace):
    project = Project.objects.create(name="Ops", identifier="OPS", workspace=workspace)
    issue_type = IssueType.objects.create(workspace=workspace, name="Spike")
    issue = Issue.objects.create(name="Item", workspace=workspace, project=project, type=issue_type)
    IssueType.objects.filter(pk=issue_type.pk).update(deleted_at=timezone.now())

    soft_delete_related_objects("db", "issuetype", issue_type.pk)

    issue = Issue.all_objects.get(pk=issue.pk)
    assert (issue.type_id, issue.deleted_at) == (issue_type.id, None)
