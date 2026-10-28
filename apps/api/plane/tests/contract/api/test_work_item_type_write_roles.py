# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""v1 work item types, properties and options are schema: only admins change
them, as in the app API. Members may still move their work items to another type."""

import pytest
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyOption,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    WorkspaceMember,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Sales", identifier="SAL", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=15, is_active=True)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    return project


@pytest.fixture
def types(workspace, project):
    types = {name: IssueType.objects.create(workspace=workspace, name=name) for name in ("Task", "Bug")}
    for issue_type in types.values():
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return types


@pytest.fixture
def option(workspace, project):
    prop = IssueProperty.objects.create(
        workspace=workspace, project=project, name="level", display_name="Level", property_type="OPTION"
    )
    return IssuePropertyOption.objects.create(workspace=workspace, project=project, property=prop, name="Low")


def _requests(workspace, project, types, option):
    prop = option.property
    base = f"/api/v1/workspaces/{workspace.slug}"
    project_base = f"{base}/projects/{project.id}"
    task = types["Task"].id
    bug = str(types["Bug"].id)
    return [
        ("post", f"{project_base}/work-item-types/", {"name": "Story"}),
        ("patch", f"{project_base}/work-item-types/{task}/", {"name": "Renamed"}),
        ("delete", f"{project_base}/work-item-types/{task}/", None),
        ("post", f"{project_base}/import-work-item-types/", {"work_item_types": [bug]}),
        ("post", f"{base}/work-item-types/", {"name": "Story"}),
        ("patch", f"{base}/work-item-types/{task}/", {"name": "Renamed"}),
        ("delete", f"{base}/work-item-types/{task}/", None),
        ("post", f"{base}/work-item-types/{task}/migrate/", {"scope": {"workspace": True}, "replacement_type_id": bug}),
        ("post", f"{project_base}/work-item-properties/", {"display_name": "Cost", "property_type": "TEXT"}),
        ("patch", f"{project_base}/work-item-properties/{prop.id}/", {"display_name": "Renamed"}),
        ("delete", f"{project_base}/work-item-properties/{prop.id}/", None),
        ("post", f"{project_base}/work-item-properties/{prop.id}/options/", {"name": "High"}),
        ("patch", f"{project_base}/work-item-properties/{prop.id}/options/{option.id}/", {"name": "Renamed"}),
        ("delete", f"{project_base}/work-item-properties/{prop.id}/options/{option.id}/", None),
        (
            "post",
            f"{project_base}/work-item-types/{task}/migrate/",
            {"scope": {"project": str(project.id)}, "replacement_type_id": bug},
        ),
    ]


@pytest.mark.parametrize("index", range(15))
def test_member_cannot_change_the_schema(api_key_client, workspace, project, types, option, index):
    method, url, body = _requests(workspace, project, types, option)[index]

    response = getattr(api_key_client, method)(url, body, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN, (method, url, response.content)


def test_member_can_migrate_listed_work_items(api_key_client, workspace, project, types):
    item = Issue.objects.create(name="Item", project=project, workspace=workspace, type=types["Task"])

    response = api_key_client.post(
        f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-item-types/{types['Task'].id}/migrate/",
        {"scope": {"work_items": [str(item.id)]}, "replacement_type_id": str(types["Bug"].id)},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK, response.content
    item.refresh_from_db()
    assert item.type_id == types["Bug"].id
