# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Database backed tests for the automation engine and its action handlers."""

import datetime
import json

import pytest
from django.utils import timezone

from plane.automation import engine
from plane.automation.actions import ActionError
from plane.automation.context import AutomationContext
from plane.automation.registry import ActionType, TriggerType
from plane.db.models import (
    Automation,
    AutomationAction,
    AutomationProject,
    AutomationRun,
    AutomationRunStatus,
    AutomationRunTriggerSource,
    AutomationScope,
    Issue,
    IssueAssignee,
    IssueComment,
    IssueLabel,
    Label,
    Notification,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def no_celery(mocker):
    """
    Every mutation queues activity logging and soft deletes queue a cascade.
    Neither needs a broker for these tests.
    """
    mocker.patch("plane.bgtasks.issue_activities_task.issue_activity.delay")
    mocker.patch("plane.bgtasks.deletion_task.soft_delete_related_objects.delay")


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
def states(db, project, create_user):
    return {
        "todo": State.objects.create(
            name="Todo", group="unstarted", color="#000", project=project, workspace=project.workspace
        ),
        "doing": State.objects.create(
            name="In Progress", group="started", color="#111", project=project, workspace=project.workspace
        ),
        "done": State.objects.create(
            name="Done", group="completed", color="#222", project=project, workspace=project.workspace
        ),
    }


@pytest.fixture
def work_item(db, project, states, create_user):
    return Issue.objects.create(
        name="Investigate the flaky checkout",
        project=project,
        state=states["todo"],
        priority="none",
        created_by=create_user,
    )


@pytest.fixture
def label(db, project):
    return Label.objects.create(name="needs-triage", project=project, workspace=project.workspace)


@pytest.fixture
def second_member(db, project):
    user = User.objects.create(email="teammate@plane.so", username="teammate")
    WorkspaceMember.objects.create(workspace=project.workspace, member=user, role=15, is_active=True)
    ProjectMember.objects.create(project=project, member=user, role=15, is_active=True)
    return user


def make_automation(project, owner, trigger_type=TriggerType.WORK_ITEM_CREATED, condition=None, **kwargs):
    return Automation.objects.create(
        workspace=project.workspace,
        project=project,
        scope=AutomationScope.PROJECT,
        name=kwargs.pop("name", "Test automation"),
        trigger_type=trigger_type,
        condition=condition,
        is_enabled=True,
        owned_by=owner,
        **kwargs,
    )


def add_action(automation, action_type, config, sort_order=10000):
    return AutomationAction.objects.create(
        automation=automation,
        workspace_id=automation.workspace_id,
        action_type=action_type,
        config=config,
        sort_order=sort_order,
    )


def context_for(work_item, project, automation, changes=None, actor_id=None):
    return AutomationContext(
        work_item=work_item,
        project=project,
        actor_id=actor_id,
        changes=changes or {},
        trigger_type=automation.trigger_type,
        automation=automation,
    )


class TestChangeProperty:
    def test_sets_state(self, project, create_user, work_item, states):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "state_id", "change_type": "set", "value": str(states["doing"].id)},
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.state_id == states["doing"].id
        assert run.status == AutomationRunStatus.SUCCESS

    def test_sets_priority(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(
            automation, ActionType.CHANGE_PROPERTY, {"property": "priority", "change_type": "set", "value": "urgent"}
        )

        engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.priority == "urgent"

    def test_no_op_change_is_skipped(self, project, create_user, work_item, states):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "state_id", "change_type": "set", "value": str(states["todo"].id)},
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.SKIPPED
        assert run.steps[0]["status"] == "skipped"

    def test_state_from_another_project_is_rejected(self, project, create_user, work_item, workspace):
        other_project = Project.objects.create(
            name="Other", identifier="OTH", workspace=workspace, created_by=create_user
        )
        foreign_state = State.objects.create(
            name="Elsewhere", group="started", color="#333", project=other_project, workspace=workspace
        )
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "state_id", "change_type": "set", "value": str(foreign_state.id)},
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.FAILED
        assert "does not belong to this project" in run.steps[0]["error"]

    def test_adds_assignees_only_for_project_members(self, project, create_user, work_item, second_member):
        outsider = User.objects.create(email="outsider@plane.so", username="outsider")
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {
                "property": "assignee_ids",
                "change_type": "add",
                "value": [str(second_member.id), str(outsider.id)],
            },
        )

        engine.execute(automation, context_for(work_item, project, automation))

        assigned = set(IssueAssignee.objects.filter(issue=work_item).values_list("assignee_id", flat=True))
        assert assigned == {second_member.id}

    def test_removes_assignees(self, project, create_user, work_item, second_member):
        IssueAssignee.objects.create(
            issue=work_item,
            assignee=second_member,
            project=project,
            workspace=project.workspace,
        )
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "assignee_ids", "change_type": "remove", "value": [str(second_member.id)]},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        assert not IssueAssignee.objects.filter(issue=work_item).exists()

    def test_adds_labels(self, project, create_user, work_item, label):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "label_ids", "change_type": "add", "value": [str(label.id)]},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        assert IssueLabel.objects.filter(issue=work_item, label=label).exists()

    def test_sets_a_cycle_from_a_single_select_value(self, project, create_user, work_item):
        # The single-select picker sends a bare id string, not a list.
        from plane.db.models import Cycle, CycleIssue

        cycle = Cycle.objects.create(
            name="Sprint 1", project=project, workspace=project.workspace, owned_by=create_user
        )
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "cycle_id", "change_type": "set", "value": str(cycle.id)},
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.SUCCESS
        assert CycleIssue.objects.filter(issue=work_item, cycle=cycle).exists()

    def test_clears_a_cycle(self, project, create_user, work_item):
        from plane.db.models import Cycle, CycleIssue

        cycle = Cycle.objects.create(
            name="Sprint 1", project=project, workspace=project.workspace, owned_by=create_user
        )
        CycleIssue.objects.create(issue=work_item, cycle=cycle, project=project, workspace=project.workspace)
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.CHANGE_PROPERTY, {"property": "cycle_id", "change_type": "clear"})

        engine.execute(automation, context_for(work_item, project, automation))

        assert not CycleIssue.objects.filter(issue=work_item).exists()

    def test_adds_a_module_from_a_list_value(self, project, create_user, work_item):
        from plane.db.models import Module, ModuleIssue

        module = Module.objects.create(name="Billing", project=project, workspace=project.workspace)
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "module_ids", "change_type": "add", "value": [str(module.id)]},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        assert ModuleIssue.objects.filter(issue=work_item, module=module).exists()

    def test_shifts_a_date(self, project, create_user, work_item):
        work_item.target_date = datetime.date(2026, 7, 24)
        work_item.save(update_fields=["target_date"])
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "target_date", "change_type": "shift_days", "value": 7},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.target_date == datetime.date(2026, 7, 31)

    def test_sets_a_relative_date(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "target_date", "change_type": "set", "value": {"mode": "relative", "days": 3}},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.target_date == timezone.now().astimezone(datetime.UTC).date() + datetime.timedelta(days=3)

    def test_clears_a_date(self, project, create_user, work_item):
        work_item.target_date = datetime.date(2026, 7, 24)
        work_item.save(update_fields=["target_date"])
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.CHANGE_PROPERTY, {"property": "target_date", "change_type": "clear"})

        engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.target_date is None

    def test_unknown_property_fails_the_step(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.CHANGE_PROPERTY, {"change_type": "set", "value": "x"})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.FAILED
        assert "No property selected" in run.steps[0]["error"]

    def test_estimate_uses_the_activity_key_the_tracker_expects(self, project, create_user, work_item, mocker):
        # `update_issue_activity` dispatches on `estimate_point`, not the
        # `estimate_point_id` column name the designer sends.
        from plane.db.models import Estimate, EstimatePoint

        estimate = Estimate.objects.create(name="Points", project=project, workspace=project.workspace, type="points")
        point = EstimatePoint.objects.create(
            estimate=estimate, project=project, workspace=project.workspace, key=1, value="3"
        )
        spy = mocker.patch("plane.bgtasks.issue_activities_task.issue_activity.delay")
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "estimate_point_id", "change_type": "set", "value": str(point.id)},
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.estimate_point_id == point.id
        assert run.status == AutomationRunStatus.SUCCESS
        requested = json.loads(spy.call_args.kwargs["requested_data"])
        assert "estimate_point" in requested
        assert "estimate_point_id" not in requested

    def test_clearing_an_estimate_skips_the_activity_entry(self, project, create_user, work_item, mocker):
        from plane.db.models import Estimate, EstimatePoint

        estimate = Estimate.objects.create(name="Points", project=project, workspace=project.workspace, type="points")
        point = EstimatePoint.objects.create(
            estimate=estimate, project=project, workspace=project.workspace, key=1, value="3"
        )
        work_item.estimate_point = point
        work_item.save(update_fields=["estimate_point"])

        spy = mocker.patch("plane.bgtasks.issue_activities_task.issue_activity.delay")
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.CHANGE_PROPERTY, {"property": "estimate_point_id", "change_type": "clear"})

        run = engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.estimate_point_id is None
        assert run.status == AutomationRunStatus.SUCCESS
        # The upstream tracker would raise on a cleared estimate, so nothing is queued.
        spy.assert_not_called()


class TestAddComment:
    def test_renders_template_variables(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.ADD_COMMENT,
            {"comment_html": "<p>{{work_item.identifier}} is now {{work_item.state}}</p>"},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        comment = IssueComment.objects.get(issue=work_item)
        assert f"AUTO-{work_item.sequence_id}" in comment.comment_html
        assert "Todo" in comment.comment_html

    def test_escapes_inserted_values(self, project, create_user, work_item):
        work_item.name = "Break <script>alert(1)</script>"
        work_item.save(update_fields=["name"])
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ADD_COMMENT, {"comment_html": "<p>{{work_item.name}}</p>"})

        engine.execute(automation, context_for(work_item, project, automation))

        comment = IssueComment.objects.get(issue=work_item)
        assert "<script>" not in comment.comment_html
        assert "&lt;script&gt;" in comment.comment_html

    def test_unknown_variables_are_left_alone(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ADD_COMMENT, {"comment_html": "<p>{{work_item.colour}}</p>"})

        engine.execute(automation, context_for(work_item, project, automation))

        assert "{{work_item.colour}}" in IssueComment.objects.get(issue=work_item).comment_html

    def test_empty_body_fails(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ADD_COMMENT, {"comment_html": "   "})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.FAILED


class TestSendNotification:
    def test_notifies_assignees(self, project, create_user, work_item, second_member):
        IssueAssignee.objects.create(
            issue=work_item, assignee=second_member, project=project, workspace=project.workspace
        )
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.SEND_NOTIFICATION,
            {"recipients": ["assignees"], "title": "Heads up", "message": "{{work_item.name}} needs you"},
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        notification = Notification.objects.get(receiver=second_member)
        assert notification.title == "Heads up"
        assert work_item.name in notification.message_stripped
        assert notification.sender == f"in_app:automation:{automation.id}"
        assert run.status == AutomationRunStatus.SUCCESS

    def test_skips_when_nobody_is_eligible(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.SEND_NOTIFICATION, {"recipients": ["assignees"], "title": "Nobody home"})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.SKIPPED
        assert Notification.objects.count() == 0

    def test_does_not_notify_the_automation_owner(self, project, create_user, work_item):
        IssueAssignee.objects.create(
            issue=work_item, assignee=create_user, project=project, workspace=project.workspace
        )
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.SEND_NOTIFICATION, {"recipients": ["assignees"], "title": "Hi"})

        engine.execute(automation, context_for(work_item, project, automation))

        assert Notification.objects.count() == 0

    def test_inactive_members_are_excluded(self, project, create_user, work_item, second_member):
        IssueAssignee.objects.create(
            issue=work_item, assignee=second_member, project=project, workspace=project.workspace
        )
        ProjectMember.objects.filter(project=project, member=second_member).update(is_active=False)
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.SEND_NOTIFICATION, {"recipients": ["assignees"], "title": "Hi"})

        engine.execute(automation, context_for(work_item, project, automation))

        assert Notification.objects.count() == 0

    def test_specific_members(self, project, create_user, work_item, second_member):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.SEND_NOTIFICATION,
            {"recipients": ["specific_members"], "member_ids": [str(second_member.id)], "title": "Ping"},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        assert Notification.objects.filter(receiver=second_member).exists()

    def test_unknown_recipient_group_fails(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.SEND_NOTIFICATION, {"recipients": ["everyone"], "title": "Hi"})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.FAILED
        assert "Unknown recipient" in run.steps[0]["error"]


class TestCreateWorkItem:
    def test_creates_in_the_same_project(self, project, create_user, states):
        automation = make_automation(project, create_user, trigger_type=TriggerType.SCHEDULE)
        add_action(
            automation,
            ActionType.CREATE_WORK_ITEM,
            {
                "name": "Weekly report for {{project.name}}",
                "priority": "high",
                "state_id": str(states["todo"].id),
            },
        )

        context = AutomationContext(project=project, automation=automation, trigger_type=TriggerType.SCHEDULE)
        run = engine.execute(automation, context, trigger_source=AutomationRunTriggerSource.SCHEDULE)

        created = Issue.objects.get(name="Weekly report for Automation Project")
        assert created.priority == "high"
        assert created.state_id == states["todo"].id
        assert run.status == AutomationRunStatus.SUCCESS

    def test_links_to_the_triggering_work_item(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CREATE_WORK_ITEM,
            {"name": "Follow up", "link_to_trigger_work_item": True},
        )

        engine.execute(automation, context_for(work_item, project, automation))

        assert Issue.objects.get(name="Follow up").parent_id == work_item.id

    def test_relative_target_date(self, project, create_user):
        automation = make_automation(project, create_user, trigger_type=TriggerType.SCHEDULE)
        add_action(
            automation,
            ActionType.CREATE_WORK_ITEM,
            {"name": "Due soon", "target_date": {"mode": "relative", "days": 5}},
        )

        context = AutomationContext(project=project, automation=automation, trigger_type=TriggerType.SCHEDULE)
        engine.execute(automation, context, trigger_source=AutomationRunTriggerSource.SCHEDULE)

        expected = timezone.now().astimezone(datetime.UTC).date() + datetime.timedelta(days=5)
        assert Issue.objects.get(name="Due soon").target_date == expected

    def test_cross_workspace_project_is_rejected(self, project, create_user, work_item, db):
        other_owner = User.objects.create(email="other-owner@plane.so", username="otherowner")
        from plane.db.models import Workspace

        other_workspace = Workspace.objects.create(name="Other WS", owner=other_owner, slug="other-ws")
        foreign_project = Project.objects.create(
            name="Foreign", identifier="FRN", workspace=other_workspace, created_by=other_owner
        )
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CREATE_WORK_ITEM,
            {"name": "Nope", "project_id": str(foreign_project.id)},
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.FAILED
        assert "different workspace" in run.steps[0]["error"]

    def test_blank_name_fails(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.CREATE_WORK_ITEM, {"name": "   "})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.FAILED


class TestArchiveWorkItem:
    def test_archives(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.archived_at is not None

    def test_already_archived_is_skipped(self, project, create_user, work_item):
        work_item.archived_at = datetime.date(2026, 1, 1)
        work_item.save(update_fields=["archived_at"])
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.steps[0]["status"] == "skipped"


class TestConditions:
    def test_non_matching_condition_produces_no_run(self, project, create_user, work_item):
        automation = make_automation(
            project,
            create_user,
            condition={
                "type": "condition",
                "property": "priority",
                "operator": "in",
                "value": ["urgent"],
            },
        )
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run is None
        assert AutomationRun.objects.count() == 0
        work_item.refresh_from_db()
        assert work_item.archived_at is None

    def test_matching_condition_runs(self, project, create_user, work_item):
        work_item.priority = "urgent"
        work_item.save(update_fields=["priority"])
        automation = make_automation(
            project,
            create_user,
            condition={"type": "condition", "property": "priority", "operator": "in", "value": ["urgent"]},
        )
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        run = engine.execute(automation, context_for(work_item, project, automation))

        assert run.status == AutomationRunStatus.SUCCESS

    def test_record_skips_writes_a_skipped_run(self, project, create_user, work_item):
        automation = make_automation(
            project,
            create_user,
            condition={"type": "condition", "property": "priority", "operator": "in", "value": ["urgent"]},
        )
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        run = engine.execute(automation, context_for(work_item, project, automation), record_skips=True)

        assert run.status == AutomationRunStatus.SKIPPED
        # Skipped runs are recorded but don't count as executions.
        automation.refresh_from_db()
        assert automation.total_run_count == 0


class TestLoopProtection:
    def test_depth_limit_stops_the_chain(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        run = engine.execute(
            automation,
            context_for(work_item, project, automation),
            depth=engine.MAX_AUTOMATION_DEPTH,
        )

        assert run is None
        work_item.refresh_from_db()
        assert work_item.archived_at is None

    def test_an_automation_cannot_appear_twice_in_one_chain(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        run = engine.execute(
            automation,
            context_for(work_item, project, automation),
            depth=1,
            ancestor_automation_ids=[str(automation.id)],
        )

        assert run is None

    def test_activity_logging_carries_the_chain(self, project, create_user, work_item, states, mocker):
        spy = mocker.patch("plane.bgtasks.issue_activities_task.issue_activity.delay")
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "state_id", "change_type": "set", "value": str(states["doing"].id)},
        )

        engine.execute(automation, context_for(work_item, project, automation), depth=1)

        passed = spy.call_args.kwargs["automation_context"]
        assert passed["depth"] == 2
        assert passed["automation_ids"] == [str(automation.id)]


class TestRunBookkeeping:
    def test_statistics_accumulate(self, project, create_user, work_item, states):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "priority", "change_type": "set", "value": "high"},
        )

        engine.execute(automation, context_for(work_item, project, automation))
        automation.refresh_from_db()

        assert automation.total_run_count == 1
        assert automation.failed_run_count == 0
        assert automation.last_run_status == AutomationRunStatus.SUCCESS
        assert automation.last_run_at is not None
        assert automation.average_duration_ms is not None

    def test_failures_are_counted(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ADD_COMMENT, {"comment_html": ""})

        engine.execute(automation, context_for(work_item, project, automation))
        automation.refresh_from_db()

        assert automation.failed_run_count == 1
        assert automation.last_run_status == AutomationRunStatus.FAILED

    def test_actions_run_in_sort_order(self, project, create_user, work_item, states):
        automation = make_automation(project, create_user)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "priority", "change_type": "set", "value": "low"},
            sort_order=20000,
        )
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "priority", "change_type": "set", "value": "high"},
            sort_order=10000,
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.priority == "low"
        assert len(run.steps) == 2

    def test_one_failing_action_does_not_stop_the_rest(self, project, create_user, work_item):
        automation = make_automation(project, create_user)
        add_action(automation, ActionType.ADD_COMMENT, {"comment_html": ""}, sort_order=10000)
        add_action(
            automation,
            ActionType.CHANGE_PROPERTY,
            {"property": "priority", "change_type": "set", "value": "high"},
            sort_order=20000,
        )

        run = engine.execute(automation, context_for(work_item, project, automation))

        work_item.refresh_from_db()
        assert work_item.priority == "high"
        assert run.status == AutomationRunStatus.PARTIAL


class TestTriggerActionCompatibility:
    def test_deleted_trigger_drops_entity_actions(self, project, create_user):
        automation = make_automation(project, create_user, trigger_type=TriggerType.WORK_ITEM_DELETED)
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        # `archive_work_item` isn't allowed for a deleted work item, so nothing
        # is left to execute.
        context = AutomationContext(project=project, automation=automation, trigger_type=automation.trigger_type)
        assert engine.execute(automation, context) is None

    def test_entity_actions_are_skipped_without_a_work_item(self, project, create_user):
        automation = make_automation(project, create_user, trigger_type=TriggerType.SCHEDULE)
        add_action(automation, ActionType.ARCHIVE_WORK_ITEM, {})

        context = AutomationContext(project=project, automation=automation, trigger_type=TriggerType.SCHEDULE)
        run = engine.execute(automation, context, trigger_source=AutomationRunTriggerSource.SCHEDULE)

        assert run.status == AutomationRunStatus.SKIPPED
        assert "needs a work item" in run.steps[0]["error"]


class TestWorkspaceScope:
    def test_project_selection_drives_the_fan_out(self, db, workspace, create_user):
        from plane.automation import dispatch

        first = Project.objects.create(name="First", identifier="FST", workspace=workspace, created_by=create_user)
        second = Project.objects.create(name="Second", identifier="SND", workspace=workspace, created_by=create_user)
        Project.objects.create(name="Third", identifier="TRD", workspace=workspace, created_by=create_user)

        automation = Automation.objects.create(
            workspace=workspace,
            scope=AutomationScope.WORKSPACE,
            name="Global rule",
            trigger_type=TriggerType.SCHEDULE,
            is_enabled=True,
            owned_by=create_user,
        )
        AutomationProject.objects.create(automation=automation, project=first, workspace=workspace)
        AutomationProject.objects.create(automation=automation, project=second, workspace=workspace)

        assert set(dispatch.target_projects(automation).values_list("id", flat=True)) == {first.id, second.id}

    def test_applies_to_all_projects_covers_the_workspace(self, db, workspace, create_user):
        from plane.automation import dispatch

        Project.objects.create(name="One", identifier="ONE", workspace=workspace, created_by=create_user)
        Project.objects.create(name="Two", identifier="TWO", workspace=workspace, created_by=create_user)

        automation = Automation.objects.create(
            workspace=workspace,
            scope=AutomationScope.WORKSPACE,
            name="Everywhere",
            trigger_type=TriggerType.SCHEDULE,
            applies_to_all_projects=True,
            is_enabled=True,
            owned_by=create_user,
        )

        assert dispatch.target_projects(automation).count() == 2


class TestActionErrorContract:
    def test_action_error_is_an_exception(self):
        assert issubclass(ActionError, Exception)


class TestActivityHook:
    """`issue_activity` is the entry point for every event based automation."""

    @pytest.fixture(autouse=True)
    def quiet_notifications(self, mocker):
        mocker.patch("plane.bgtasks.issue_activities_task.notifications.delay")

    def _log_creation(self, work_item, project, create_user):
        from plane.bgtasks.issue_activities_task import issue_activity

        issue_activity(
            type="issue.activity.created",
            requested_data=json.dumps({"name": work_item.name}),
            current_instance=None,
            issue_id=str(work_item.id),
            actor_id=str(create_user.id),
            project_id=str(project.id),
            epoch=int(timezone.now().timestamp()),
        )

    def test_no_dispatch_when_the_workspace_has_no_automations(self, project, create_user, work_item, mocker):
        spy = mocker.patch("plane.bgtasks.issue_activities_task.dispatch_work_item_automations.delay")

        self._log_creation(work_item, project, create_user)

        # Every activity row would otherwise queue a task that finds nothing.
        spy.assert_not_called()

    def test_no_dispatch_when_the_only_automation_is_disabled(self, project, create_user, work_item, mocker):
        automation = make_automation(project, create_user)
        automation.is_enabled = False
        automation.save(update_fields=["is_enabled"])
        spy = mocker.patch("plane.bgtasks.issue_activities_task.dispatch_work_item_automations.delay")

        self._log_creation(work_item, project, create_user)

        spy.assert_not_called()

    def test_dispatches_once_an_enabled_automation_exists(self, project, create_user, work_item, mocker):
        make_automation(project, create_user)
        spy = mocker.patch("plane.bgtasks.issue_activities_task.dispatch_work_item_automations.delay")

        self._log_creation(work_item, project, create_user)

        spy.assert_called_once()
        kwargs = spy.call_args.kwargs
        assert kwargs["activity_type"] == "issue.activity.created"
        assert kwargs["workspace_id"] == str(project.workspace_id)
        assert kwargs["automation_context"] is None

    def test_forwards_the_automation_chain_when_one_is_supplied(self, project, create_user, work_item, mocker):
        make_automation(project, create_user)
        spy = mocker.patch("plane.bgtasks.issue_activities_task.dispatch_work_item_automations.delay")

        from plane.bgtasks.issue_activities_task import issue_activity

        chain = {"depth": 2, "automation_ids": ["abc"]}
        issue_activity(
            type="issue.activity.updated",
            requested_data=json.dumps({"priority": "high"}),
            current_instance=json.dumps({"priority": "none"}),
            issue_id=str(work_item.id),
            actor_id=str(create_user.id),
            project_id=str(project.id),
            epoch=int(timezone.now().timestamp()),
            automation_context=chain,
        )

        assert spy.call_args.kwargs["automation_context"] == chain
