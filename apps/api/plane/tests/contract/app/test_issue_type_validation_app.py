# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Regression tests: a work item's `type` must be enabled for the project
it belongs to (types can otherwise be assigned cross-project since
`IssueType` is workspace-scoped, not project-scoped)."""

import pytest
from rest_framework import status

from plane.db.models import IssueType, Project, ProjectIssueType, ProjectMember, State


@pytest.fixture
def project_a(db, workspace, create_user):
    project = Project.objects.create(
        name="Project A",
        identifier="PA",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def project_b(db, workspace, create_user):
    project = Project.objects.create(
        name="Project B",
        identifier="PB",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    State.objects.create(name="Todo", group="backlog", project=project, workspace=workspace, default=True)
    return project


@pytest.fixture
def type_a(db, workspace, project_a):
    """A work item type enabled only for project A."""
    issue_type = IssueType.objects.create(workspace=workspace, name="Bug", is_epic=False)
    ProjectIssueType.objects.create(project=project_a, issue_type=issue_type, workspace=workspace)
    return issue_type


def issues_url(slug, project_id):
    return f"/api/workspaces/{slug}/projects/{project_id}/issues/"


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkItemTypeCrossProjectValidationApp:
    def test_create_work_item_with_foreign_project_type_rejected(self, session_client, workspace, project_b, type_a):
        response = session_client.post(
            issues_url(workspace.slug, project_b.id),
            {"name": "Cross project issue", "type": str(type_a.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_work_item_with_own_project_type_succeeds(self, session_client, workspace, project_a, type_a):
        State.objects.create(name="Todo", group="backlog", project=project_a, workspace=workspace, default=True)
        response = session_client.post(
            issues_url(workspace.slug, project_a.id),
            {"name": "Same project issue", "type": str(type_a.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
