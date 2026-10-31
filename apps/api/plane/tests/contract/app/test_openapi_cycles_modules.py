# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The cycle and module endpoints accept and return what the OpenAPI schema documents."""

from datetime import timedelta

import jsonschema
import pytest
from django.utils import timezone

from plane.db.models import (
    Cycle,
    CycleIssue,
    CycleUserProperties,
    Estimate,
    EstimatePoint,
    Issue,
    IssueAssignee,
    IssueLabel,
    Label,
    Module,
    ModuleIssue,
    ProjectMember,
    State,
    UserFavorite,
)
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query, documented_request
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="CM")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    estimate = Estimate.objects.create(name="Points", type="points", project=project, workspace=workspace)
    project.estimate = estimate
    project.save()
    return project


@pytest.fixture
def plan(create_user, workspace, project):
    now = timezone.now()
    issue_type = link_starter_type(project)
    done = State.objects.create(name="Done", group="completed", project=project, workspace=workspace)
    State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    point = EstimatePoint.objects.create(
        estimate=project.estimate, key=1, value="3", project=project, workspace=workspace
    )
    label = Label.objects.create(name="bug", project=project, workspace=workspace)
    current = Cycle.objects.create(
        name="Now",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=now - timedelta(days=3),
        end_date=now + timedelta(days=3),
    )
    past = Cycle.objects.create(
        name="Past",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=now - timedelta(days=20),
        end_date=now - timedelta(days=10),
    )
    module = Module.objects.create(
        name="Mod",
        project=project,
        workspace=workspace,
        start_date=(now - timedelta(days=3)).date(),
        target_date=(now + timedelta(days=3)).date(),
    )
    issues = []
    for name, state in [("a", done), ("b", None)]:
        issue = Issue.objects.create(
            name=name,
            project=project,
            workspace=workspace,
            type=issue_type,
            estimate_point=point,
            created_by=create_user,
            **({"state": state, "completed_at": now} if state else {}),
        )
        IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=workspace)
        IssueLabel.objects.create(issue=issue, label=label, project=project, workspace=workspace)
        CycleIssue.objects.create(issue=issue, cycle=current, project=project, workspace=workspace)
        ModuleIssue.objects.create(issue=issue, module=module, project=project, workspace=workspace)
        issues.append(issue)
    CycleIssue.objects.create(issue=issues[0], cycle=past, project=project, workspace=workspace)
    return {"current": current, "past": past, "module": module, "issues": issues}


def url(workspace, project, path=""):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/{path}"


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestCycleResponses:
    def test_cycles(self, session_client, workspace, project, plan):
        cycle = plan["current"]
        assert documented(session_client.get(url(workspace, project, "cycles/")))
        assert documented(session_client.get(url(workspace, project, "cycles/"), {"cycle_view": "current"}))
        documented(session_client.get(url(workspace, project, f"cycles/{cycle.id}/")))
        documented(session_client.patch(url(workspace, project, f"cycles/{cycle.id}/"), {"name": "N"}, format="json"))
        documented(session_client.post(url(workspace, project, "cycles/"), {"name": "Draft"}, format="json"), 201)
        body = {"start_date": "2030-01-01", "end_date": "2030-01-10"}
        assert documented(session_client.post(url(workspace, project, "cycles/date-check/"), body, format="json"))[
            "status"
        ]
        assert documented(session_client.get(f"/api/workspaces/{workspace.slug}/cycles/"))

    def test_cycle_stats(self, session_client, workspace, project, plan):
        cycle = plan["current"]
        documented(session_client.get(url(workspace, project, f"cycles/{cycle.id}/progress/")))
        issues = documented(session_client.get(url(workspace, project, f"cycles/{cycle.id}/analytics/")))
        assert issues["assignees"] and issues["labels"] and issues["completion_chart"]
        points = documented(
            session_client.get(url(workspace, project, f"cycles/{cycle.id}/analytics/"), {"type": "points"})
        )
        assert points["assignees"]
        documented(session_client.get(url(workspace, project, f"cycles/{cycle.id}/user-properties/")))
        patch = {"filters": {}}
        documented(
            session_client.patch(url(workspace, project, f"cycles/{cycle.id}/user-properties/"), patch, format="json"),
            201,
        )

    def test_cycle_issues(self, session_client, workspace, project, plan):
        cycle = plan["current"]
        base = url(workspace, project, f"cycles/{cycle.id}/cycle-issues/")
        assert documented(session_client.get(base))["results"]
        assert documented(session_client.get(base, {"group_by": "state_id"}))["results"]
        loose = Issue.objects.create(
            name="c", project=project, workspace=project.workspace, type=plan["issues"][0].type
        )
        documented(session_client.post(base, {"issues": [str(loose.id)]}, format="json"), 201)

    def test_archive(self, session_client, workspace, project, plan):
        past = plan["past"]
        documented(session_client.post(url(workspace, project, f"cycles/{past.id}/archive/")))
        assert documented(session_client.get(url(workspace, project, "archived-cycles/")))
        detail = documented(session_client.get(url(workspace, project, f"archived-cycles/{past.id}/")))
        assert detail["distribution"]["assignees"] and detail["estimate_distribution"]["assignees"]

    def test_transfer(self, session_client, workspace, project, plan):
        body = {"new_cycle_id": str(plan["current"].id)}
        documented(
            session_client.post(
                url(workspace, project, f"cycles/{plan['past'].id}/transfer-issues/"), body, format="json"
            )
        )


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestModuleResponses:
    def test_modules(self, session_client, workspace, project, plan):
        module = plan["module"]
        assert documented(session_client.get(url(workspace, project, "modules/")))
        assert documented(session_client.get(url(workspace, project, "modules/"), {"fields": "id,name"}))
        detail = documented(session_client.get(url(workspace, project, f"modules/{module.id}/")))
        assert detail["distribution"]["completion_chart"] and detail["estimate_distribution"]["labels"]
        documented(session_client.patch(url(workspace, project, f"modules/{module.id}/"), {"name": "M"}, format="json"))
        documented(session_client.post(url(workspace, project, "modules/"), {"name": "New"}, format="json"), 201)
        assert documented(session_client.get(f"/api/workspaces/{workspace.slug}/modules/"))
        documented(session_client.get(url(workspace, project, f"modules/{module.id}/user-properties/")))
        patch = {"filters": {}}
        documented(
            session_client.patch(
                url(workspace, project, f"modules/{module.id}/user-properties/"), patch, format="json"
            ),
            201,
        )

    def test_module_issues(self, session_client, workspace, project, plan):
        module, issue = plan["module"], plan["issues"][0]
        base = url(workspace, project, f"modules/{module.id}/issues/")
        assert documented(session_client.get(base))["results"]
        loose = Issue.objects.create(name="c", project=project, workspace=project.workspace, type=issue.type)
        documented(session_client.post(base, {"issues": [str(loose.id)]}, format="json"), 201)
        body = {"modules": [str(module.id)]}
        documented(
            session_client.post(url(workspace, project, f"issues/{loose.id}/modules/"), body, format="json"), 201
        )

    def test_archive(self, session_client, workspace, project, plan):
        module = plan["module"]
        Module.objects.filter(pk=module.id).update(status="completed")
        documented(session_client.post(url(workspace, project, f"modules/{module.id}/archive/")))
        assert documented(session_client.get(url(workspace, project, "archived-modules/")))
        documented(session_client.get(url(workspace, project, f"archived-modules/{module.id}/")))


BASE = "/api/workspaces/{slug}/projects/{project_id}"


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestCycleRequests:
    def test_create_and_update(self, session_client, workspace, project):
        ids = {"slug": workspace.slug, "project_id": project.id}
        body = {"name": "Next", "start_date": "2030-01-01", "end_date": "2030-01-10", "logo_props": {"in_use": "icon"}}
        url, body = sent(BASE + "/cycles/", "post", body, **ids)
        created = documented(session_client.post(url, body, format="json"), 201)
        url, body = sent(
            BASE + "/cycles/{pk}/", "patch", {"description": "d", "sort_order": 2}, pk=created["id"], **ids
        )
        assert documented(session_client.patch(url, body, format="json"))["sort_order"] == 2
        with pytest.raises(jsonschema.ValidationError):
            documented_request(BASE + "/cycles/{pk}/", "patch", {"version": 1})

    def test_date_check_favorite_and_transfer(self, session_client, workspace, project, plan):
        ids = {"slug": workspace.slug, "project_id": project.id}
        body = {"start_date": "2030-02-01", "end_date": "2030-02-10", "cycle_id": str(plan["current"].id)}
        url, body = sent(BASE + "/cycles/date-check/", "post", body, **ids)
        assert documented(session_client.post(url, body, format="json"))["status"]
        url, body = sent(BASE + "/user-favorite-cycles/", "post", {"cycle": str(plan["current"].id)}, **ids)
        assert session_client.post(url, body, format="json").status_code == 204
        assert UserFavorite.objects.filter(entity_type="cycle", entity_identifier=plan["current"].id).exists()
        route = BASE + "/cycles/{cycle_id}/transfer-issues/"
        url, body = sent(route, "post", {"new_cycle_id": str(plan["current"].id)}, cycle_id=plan["past"].id, **ids)
        documented(session_client.post(url, body, format="json"))

    def test_cycle_issues(self, session_client, workspace, project, plan):
        cycle = plan["current"]
        ids = {"slug": workspace.slug, "project_id": project.id, "cycle_id": cycle.id}
        loose = Issue.objects.create(name="c", project=project, workspace=workspace, type=plan["issues"][0].type)
        url, body = sent(BASE + "/cycles/{cycle_id}/cycle-issues/", "post", {"issues": [str(loose.id)]}, **ids)
        documented(session_client.post(url, body, format="json"), 201)
        assert CycleIssue.objects.filter(cycle=cycle, issue=loose).exists()
        with pytest.raises(jsonschema.ValidationError):
            documented_request(BASE + "/cycles/{cycle_id}/cycle-issues/", "post", {"issue": str(loose.id)})

    def test_user_properties(self, session_client, workspace, project, plan):
        cycle = plan["current"]
        ids = {"slug": workspace.slug, "project_id": project.id, "cycle_id": cycle.id}
        route = BASE + "/cycles/{cycle_id}/user-properties/"
        documented(session_client.get(route.format(**ids)))
        body = {"display_filters": {"layout": "kanban"}, "rich_filters": {}}
        url, body = sent(route, "patch", body, **ids)
        documented(session_client.patch(url, body, format="json"), 201)
        assert CycleUserProperties.objects.get(cycle=cycle).display_filters == {"layout": "kanban"}

    def test_query_parameters(self, session_client, workspace, project, plan):
        assert documented_query(BASE + "/cycles/", "get") == {"cycle_view"}
        assert documented_query("/api/workspaces/{slug}/cycles/", "get") == set()
        assert documented_query(BASE + "/cycles/{cycle_id}/analytics/", "get") == {"type"}
        route = BASE + "/cycles/{cycle_id}/cycle-issues/"
        expected = {"cursor", "per_page", "group_by", "sub_group_by", "order_by", "sub_issue", "filters", "pql"}
        assert expected | {"layout", "state", "priority"} <= documented_query(route, "get")
        url = route.format(slug=workspace.slug, project_id=project.id, cycle_id=plan["current"].id)
        params = {"group_by": "priority", "order_by": "-created_at", "sub_issue": "false", "per_page": 10}
        assert documented(session_client.get(url, {**params, "cursor": "10:0:0"}))["results"]
