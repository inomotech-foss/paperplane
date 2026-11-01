# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The automation endpoints document the bodies and query params they read."""

import jsonschema
import pytest

from plane.db.models import ProjectMember
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, documented_query, documented_request

WORKSPACE = "/api/workspaces/{slug}/automations/"
PROJECT = "/api/workspaces/{slug}/projects/{project_id}/automations/"


@pytest.mark.contract
@pytest.mark.parametrize("base", [WORKSPACE, PROJECT])
def test_bodies_and_query(base):
    documented_request(
        base,
        "post",
        {"name": "A", "trigger_type": "work_item.created", "condition": None, "applies_to_all_projects": True},
    )
    documented_request(base + "{pk}/", "patch", {"is_enabled": False, "project_ids": []})
    documented_request(base + "{automation_id}/actions/", "post", {"action_type": "add_comment", "config": {}})
    documented_request(base + "{automation_id}/actions/{pk}/", "patch", {"sort_order": 2})
    with pytest.raises(jsonschema.ValidationError):
        documented_request(base + "{pk}/", "patch", {"total_run_count": 3})
    assert documented_query(base + "{automation_id}/runs/", "get") == {"cursor", "per_page", "status"}
    assert documented_query(base + "{automation_id}/actions/", "get") == set()


@pytest.mark.contract
@pytest.mark.django_db
def test_run_status_filter(session_client, create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="AU")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    url = PROJECT.format(slug=workspace.slug, project_id=project.id)
    body = {"name": "A", "trigger_type": "work_item.created"}
    automation = documented(session_client.post(url, body, format="json"), 201)
    page = documented(session_client.get(f"{url}{automation['id']}/runs/", {"status": "failed"}))
    assert page["results"] == []
