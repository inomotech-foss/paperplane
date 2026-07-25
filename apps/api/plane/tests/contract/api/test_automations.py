# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the automation designer endpoints."""

import pytest
from rest_framework import status

from plane.db.models import (
    Automation,
    AutomationAction,
    AutomationProject,
    AutomationRun,
    AutomationScope,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)

pytestmark = pytest.mark.contract


@pytest.fixture(autouse=True)
def no_celery(mocker):
    mocker.patch("plane.bgtasks.deletion_task.soft_delete_related_objects.delay")
    mocker.patch("plane.bgtasks.automation_task.run_automation_now.delay")


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Automation Project",
        identifier="AUTO",
        workspace=workspace,
        created_by=create_user,
        timezone="UTC",
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def state(db, project):
    return State.objects.create(
        name="Todo", group="unstarted", color="#000", project=project, workspace=project.workspace
    )


@pytest.fixture
def base_url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/automations/"


@pytest.fixture
def workspace_url(workspace):
    return f"/api/workspaces/{workspace.slug}/automations/"


def create_automation_via_api(client, url, **overrides):
    payload = {
        "name": "Escalate stale urgent work",
        "description": "Nudge whoever owns it",
        "trigger_type": "work_item.created",
    }
    payload.update(overrides)
    return client.post(url, payload, format="json")


class TestMetadata:
    def test_returns_the_catalog(self, session_client, workspace):
        response = session_client.get(f"/api/workspaces/{workspace.slug}/automation-metadata/")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert {"triggers", "condition_properties", "mutable_properties", "actions"} <= set(body)
        trigger_keys = {trigger["key"] for trigger in body["triggers"]}
        assert "work_item.created" in trigger_keys
        assert "schedule" in trigger_keys

    def test_requires_authentication(self, api_client, workspace):
        response = api_client.get(f"/api/workspaces/{workspace.slug}/automation-metadata/")
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


class TestProjectAutomationCrud:
    def test_create_and_list(self, session_client, base_url, create_user):
        response = create_automation_via_api(session_client, base_url)

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["name"] == "Escalate stale urgent work"
        assert body["scope"] == AutomationScope.PROJECT
        assert body["is_enabled"] is False
        assert body["owned_by"] == str(create_user.id)
        assert body["actions"] == []

        listed = session_client.get(base_url)
        assert listed.status_code == status.HTTP_200_OK
        assert len(listed.json()) == 1

    def test_retrieve(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]

        response = session_client.get(f"{base_url}{automation_id}/")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["id"] == automation_id

    def test_name_is_required(self, session_client, base_url):
        response = session_client.post(base_url, {"name": "   "}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.json()

    def test_unknown_trigger_is_rejected(self, session_client, base_url):
        response = create_automation_via_api(session_client, base_url, trigger_type="work_item.exploded")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_trigger_cannot_be_changed_after_creation(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]

        response = session_client.patch(
            f"{base_url}{automation_id}/", {"trigger_type": "work_item.updated"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "trigger_type" in response.json()

    def test_update_name_and_condition(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]

        response = session_client.patch(
            f"{base_url}{automation_id}/",
            {
                "name": "Renamed",
                "condition": {
                    "type": "group",
                    "logical_operator": "and",
                    "children": [{"type": "condition", "property": "priority", "operator": "in", "value": ["urgent"]}],
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Renamed"

    def test_invalid_condition_is_rejected(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]

        response = session_client.patch(
            f"{base_url}{automation_id}/",
            {"condition": {"type": "condition", "property": "colour", "operator": "in", "value": ["red"]}},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "condition" in response.json()

    def test_cannot_enable_without_actions(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]

        response = session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": True}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_enabled" in response.json()

    def test_can_enable_once_an_action_exists(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]
        session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "archive_work_item", "config": {}},
            format="json",
        )

        response = session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": True}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_enabled"] is True

    def test_delete_requires_disabling_first(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]
        session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "archive_work_item", "config": {}},
            format="json",
        )
        session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": True}, format="json")

        blocked = session_client.delete(f"{base_url}{automation_id}/")
        assert blocked.status_code == status.HTTP_400_BAD_REQUEST

        session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": False}, format="json")
        allowed = session_client.delete(f"{base_url}{automation_id}/")
        assert allowed.status_code == status.HTTP_204_NO_CONTENT
        assert not Automation.objects.filter(pk=automation_id).exists()

    def test_missing_automation_is_a_404(self, session_client, base_url):
        import uuid

        response = session_client.get(f"{base_url}{uuid.uuid4()}/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_workspace_scoped_rules_are_not_listed_under_a_project(
        self, session_client, base_url, workspace, create_user
    ):
        Automation.objects.create(
            workspace=workspace,
            scope=AutomationScope.WORKSPACE,
            name="Global",
            trigger_type="work_item.created",
            applies_to_all_projects=True,
            owned_by=create_user,
        )

        assert session_client.get(base_url).json() == []


class TestScheduleValidation:
    def test_valid_fixed_schedule_is_accepted(self, session_client, base_url):
        response = create_automation_via_api(
            session_client,
            base_url,
            trigger_type="schedule",
            trigger_config={
                "mode": "fixed",
                "frequency": "weekly",
                "days_of_week": [1],
                "hour": 9,
                "minute": 0,
                "timezone": "Europe/Berlin",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["schedule_summary"] == "weekly on Monday at 09:00 (Europe/Berlin)"

    def test_valid_cron_is_accepted(self, session_client, base_url):
        response = create_automation_via_api(
            session_client,
            base_url,
            trigger_type="schedule",
            trigger_config={"mode": "cron", "cron": "0 9 * * 1-5", "timezone": "UTC"},
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_malformed_cron_is_rejected(self, session_client, base_url):
        response = create_automation_via_api(
            session_client,
            base_url,
            trigger_type="schedule",
            trigger_config={"mode": "cron", "cron": "not a cron"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "trigger_config" in response.json()

    def test_weekly_without_days_is_rejected(self, session_client, base_url):
        response = create_automation_via_api(
            session_client,
            base_url,
            trigger_type="schedule",
            trigger_config={"mode": "fixed", "frequency": "weekly", "days_of_week": [], "hour": 9, "minute": 0},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_enabling_a_schedule_sets_the_next_run(self, session_client, base_url):
        automation_id = create_automation_via_api(
            session_client,
            base_url,
            trigger_type="schedule",
            trigger_config={"mode": "fixed", "frequency": "daily", "hour": 9, "minute": 0, "timezone": "UTC"},
        ).json()["id"]
        session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "create_work_item", "config": {"name": "Daily standup notes"}},
            format="json",
        )

        enabled = session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": True}, format="json")
        assert enabled.status_code == status.HTTP_200_OK
        assert enabled.json()["next_run_at"] is not None

        disabled = session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": False}, format="json")
        assert disabled.json()["next_run_at"] is None

    def test_event_triggers_have_no_schedule_summary(self, session_client, base_url):
        response = create_automation_via_api(session_client, base_url)
        assert response.json()["schedule_summary"] is None


class TestActions:
    @pytest.fixture
    def automation_id(self, session_client, base_url):
        return create_automation_via_api(session_client, base_url).json()["id"]

    def test_create_list_update_delete(self, session_client, base_url, automation_id, state):
        actions_url = f"{base_url}{automation_id}/actions/"

        created = session_client.post(
            actions_url,
            {
                "action_type": "change_property",
                "config": {"property": "state_id", "change_type": "set", "value": str(state.id)},
            },
            format="json",
        )
        assert created.status_code == status.HTTP_201_CREATED
        action_id = created.json()["id"]

        listed = session_client.get(actions_url)
        assert listed.status_code == status.HTTP_200_OK
        assert len(listed.json()) == 1

        updated = session_client.patch(
            f"{actions_url}{action_id}/",
            {"config": {"property": "priority", "change_type": "set", "value": "urgent"}},
            format="json",
        )
        assert updated.status_code == status.HTTP_200_OK
        assert updated.json()["config"]["property"] == "priority"

        deleted = session_client.delete(f"{actions_url}{action_id}/")
        assert deleted.status_code == status.HTTP_204_NO_CONTENT
        assert not AutomationAction.objects.filter(pk=action_id).exists()

    def test_sort_order_appends_by_default(self, session_client, base_url, automation_id):
        actions_url = f"{base_url}{automation_id}/actions/"
        first = session_client.post(
            actions_url, {"action_type": "archive_work_item", "config": {}}, format="json"
        ).json()
        second = session_client.post(
            actions_url,
            {"action_type": "add_comment", "config": {"comment_html": "<p>hi</p>"}},
            format="json",
        ).json()

        assert second["sort_order"] > first["sort_order"]

    def test_unknown_action_type_is_rejected(self, session_client, base_url, automation_id):
        response = session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "launch_rocket", "config": {}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_property_config_is_validated(self, session_client, base_url, automation_id):
        response = session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "change_property", "config": {"property": "priority", "change_type": "add"}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "config" in response.json()

    def test_notification_needs_recipients(self, session_client, base_url, automation_id):
        response = session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "send_notification", "config": {"title": "Hi"}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_webhook_url_scheme_is_validated(self, session_client, base_url, automation_id):
        response = session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "call_webhook", "config": {"url": "ftp://example.com/hook"}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_delete_the_only_action_while_enabled(self, session_client, base_url, automation_id):
        actions_url = f"{base_url}{automation_id}/actions/"
        action_id = session_client.post(
            actions_url, {"action_type": "archive_work_item", "config": {}}, format="json"
        ).json()["id"]
        session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": True}, format="json")

        response = session_client.delete(f"{actions_url}{action_id}/")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "only action" in response.json()["error"]


class TestRuns:
    @pytest.fixture
    def enabled_automation(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]
        session_client.post(
            f"{base_url}{automation_id}/actions/",
            {"action_type": "archive_work_item", "config": {}},
            format="json",
        )
        session_client.patch(f"{base_url}{automation_id}/", {"is_enabled": True}, format="json")
        return automation_id

    def test_run_history_is_paginated(self, session_client, base_url, enabled_automation, workspace, project):
        from django.utils import timezone

        automation = Automation.objects.get(pk=enabled_automation)
        for _ in range(3):
            AutomationRun.objects.create(
                workspace=workspace,
                project=project,
                automation=automation,
                status="success",
                trigger_source="event",
                trigger_type=automation.trigger_type,
                started_at=timezone.now(),
                finished_at=timezone.now(),
            )

        response = session_client.get(f"{base_url}{enabled_automation}/runs/")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["count"] == 3
        assert body["total_count"] == 3
        assert len(body["results"]) == 3
        assert {step["status"] for step in body["results"]} == {"success"}

    def test_run_now_queues_the_task(self, session_client, base_url, enabled_automation, mocker):
        spy = mocker.patch("plane.app.views.automation.base.run_automation_now.delay")

        response = session_client.post(f"{base_url}{enabled_automation}/runs/")

        assert response.status_code == status.HTTP_202_ACCEPTED
        spy.assert_called_once()

    def test_run_now_requires_an_enabled_automation(self, session_client, base_url):
        automation_id = create_automation_via_api(session_client, base_url).json()["id"]

        response = session_client.post(f"{base_url}{automation_id}/runs/")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestWorkspaceScopedAutomations:
    def test_create_with_selected_projects(self, session_client, workspace_url, workspace, project, create_user):
        second = Project.objects.create(name="Second", identifier="SEC", workspace=workspace, created_by=create_user)

        response = session_client.post(
            workspace_url,
            {
                "name": "Standardise triage",
                "trigger_type": "work_item.created",
                "project_ids": [str(project.id), str(second.id)],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["scope"] == AutomationScope.WORKSPACE
        assert set(body["projects"]) == {str(project.id), str(second.id)}

    def test_create_requires_projects_or_all(self, session_client, workspace_url):
        response = session_client.post(
            workspace_url, {"name": "Nowhere", "trigger_type": "work_item.created"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "project_ids" in response.json()

    def test_applies_to_all_projects_needs_no_selection(self, session_client, workspace_url):
        response = session_client.post(
            workspace_url,
            {"name": "Everywhere", "trigger_type": "work_item.created", "applies_to_all_projects": True},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["projects"] == []

    def test_switching_to_all_projects_clears_the_selection(self, session_client, workspace_url, workspace, project):
        automation_id = session_client.post(
            workspace_url,
            {
                "name": "Triage",
                "trigger_type": "work_item.created",
                "project_ids": [str(project.id)],
            },
            format="json",
        ).json()["id"]

        response = session_client.patch(
            f"{workspace_url}{automation_id}/", {"applies_to_all_projects": True}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert not AutomationProject.objects.filter(automation_id=automation_id).exists()

    def test_narrowing_from_all_projects_is_a_two_step_edit(self, session_client, workspace_url, project):
        """
        The designer's scope radio sends `applies_to_all_projects: false` on its own,
        then the project list once the author picks one. The intermediate state has to
        save, otherwise the radio is unusable.
        """
        automation_id = session_client.post(
            workspace_url,
            {"name": "Everywhere", "trigger_type": "work_item.created", "applies_to_all_projects": True},
            format="json",
        ).json()["id"]

        narrowed = session_client.patch(
            f"{workspace_url}{automation_id}/", {"applies_to_all_projects": False}, format="json"
        )
        assert narrowed.status_code == status.HTTP_200_OK
        assert narrowed.json()["projects"] == []

        chosen = session_client.patch(
            f"{workspace_url}{automation_id}/", {"project_ids": [str(project.id)]}, format="json"
        )
        assert chosen.status_code == status.HTTP_200_OK
        assert chosen.json()["projects"] == [str(project.id)]

    def test_cannot_enable_a_workspace_rule_that_targets_no_project(self, session_client, workspace_url, project):
        automation_id = session_client.post(
            workspace_url,
            {"name": "Nowhere yet", "trigger_type": "work_item.created", "applies_to_all_projects": True},
            format="json",
        ).json()["id"]
        session_client.post(
            f"{workspace_url}{automation_id}/actions/",
            {"action_type": "archive_work_item", "config": {}},
            format="json",
        )
        session_client.patch(f"{workspace_url}{automation_id}/", {"applies_to_all_projects": False}, format="json")

        blocked = session_client.patch(f"{workspace_url}{automation_id}/", {"is_enabled": True}, format="json")
        assert blocked.status_code == status.HTTP_400_BAD_REQUEST
        assert "project_ids" in blocked.json()

        session_client.patch(f"{workspace_url}{automation_id}/", {"project_ids": [str(project.id)]}, format="json")
        allowed = session_client.patch(f"{workspace_url}{automation_id}/", {"is_enabled": True}, format="json")
        assert allowed.status_code == status.HTTP_200_OK

    def test_updating_project_ids_replaces_the_selection(
        self, session_client, workspace_url, workspace, project, create_user
    ):
        second = Project.objects.create(name="Second", identifier="SEC", workspace=workspace, created_by=create_user)
        automation_id = session_client.post(
            workspace_url,
            {"name": "Triage", "trigger_type": "work_item.created", "project_ids": [str(project.id)]},
            format="json",
        ).json()["id"]

        response = session_client.patch(
            f"{workspace_url}{automation_id}/", {"project_ids": [str(second.id)]}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["projects"] == [str(second.id)]

    def test_projects_from_another_workspace_are_ignored(self, session_client, workspace_url, create_user):
        from plane.db.models import Workspace

        other_owner = User.objects.create(email="other@plane.so", username="otherowner")
        other_workspace = Workspace.objects.create(name="Other", owner=other_owner, slug="other-workspace")
        foreign = Project.objects.create(
            name="Foreign", identifier="FRN", workspace=other_workspace, created_by=other_owner
        )

        response = session_client.post(
            workspace_url,
            {"name": "Cross", "trigger_type": "work_item.created", "project_ids": [str(foreign.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["projects"] == []

    def test_project_scoped_rules_are_not_listed_at_workspace_level(self, session_client, workspace_url, base_url):
        create_automation_via_api(session_client, base_url)
        assert session_client.get(workspace_url).json() == []


class TestPermissions:
    @pytest.fixture
    def member_client(self, api_client, db, workspace, project):
        member = User.objects.create(email="plain-member@plane.so", username="plainmember")
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        ProjectMember.objects.create(project=project, member=member, role=15, is_active=True)
        api_client.force_authenticate(user=member)
        return api_client

    def test_members_cannot_list_project_automations(self, member_client, base_url):
        response = member_client.get(base_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_members_cannot_create_project_automations(self, member_client, base_url):
        response = create_automation_via_api(member_client, base_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_members_cannot_list_workspace_automations(self, member_client, workspace_url):
        response = member_client.get(workspace_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_members_can_read_the_metadata_catalog(self, member_client, workspace):
        response = member_client.get(f"/api/workspaces/{workspace.slug}/automation-metadata/")
        assert response.status_code == status.HTTP_200_OK

    def test_outsiders_are_blocked(self, api_client, db, workspace, base_url):
        outsider = User.objects.create(email="outsider@plane.so", username="outsider")
        api_client.force_authenticate(user=outsider)

        response = api_client.get(base_url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
