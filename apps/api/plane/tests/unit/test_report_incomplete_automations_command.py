# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from plane.automation.registry import ActionType, TriggerType
from plane.db.management.commands import report_incomplete_automations as command
from plane.db.models import Automation, AutomationAction, AutomationScope, Project

pytestmark = pytest.mark.unit


@pytest.fixture
def project(db, workspace, create_user):
    return Project.objects.create(name="Reports", identifier="REP", workspace=workspace, created_by=create_user)


def make_automation(project, owner, action_config, **kwargs):
    automation = Automation.objects.create(
        workspace=project.workspace,
        project=project,
        scope=AutomationScope.PROJECT,
        name=kwargs.pop("name", "Rule"),
        trigger_type=TriggerType.WORK_ITEM_CREATED,
        owned_by=owner,
        **kwargs,
    )
    action = AutomationAction.objects.create(
        automation=automation,
        workspace_id=automation.workspace_id,
        action_type=ActionType.ADD_COMMENT,
        config=action_config,
    )
    return automation, action


def test_reports_enabled_incomplete_automations_and_changes_nothing(project, create_user):
    broken, action = make_automation(project, create_user, {"comment_html": ""}, name="Broken", is_enabled=True)
    make_automation(project, create_user, {"comment_html": "<p>Hi</p>"}, name="Fine", is_enabled=True)
    make_automation(project, create_user, {"comment_html": ""}, name="Draft", is_enabled=False)
    out = StringIO()

    with pytest.raises(CommandError, match="1 enabled automation"):
        call_command("report_incomplete_automations", stdout=out)

    report = out.getvalue()
    assert f"{project.workspace.slug} project REP {broken.id} 'Broken'" in report
    assert f"action {action.id} (add_comment): The comment body is empty." in report
    assert "Fine" not in report and "Draft" not in report
    assert Automation.objects.get(pk=broken.pk).is_enabled is True


def test_says_so_when_everything_is_complete(project, create_user):
    make_automation(project, create_user, {"comment_html": "<p>Hi</p>"}, is_enabled=True)
    out = StringIO()

    call_command("report_incomplete_automations", stdout=out)

    assert "Every enabled automation is complete." in out.getvalue()


def test_one_row_that_fails_does_not_abort_the_report(project, create_user, mocker):
    first, _ = make_automation(project, create_user, {"comment_html": "<p>Hi</p>"}, name="A", is_enabled=True)
    second, _ = make_automation(project, create_user, {"comment_html": ""}, name="B", is_enabled=True)
    real = command.engine.incomplete_run

    def incomplete_run(automation, actions):
        if automation.pk == first.pk:
            raise RuntimeError
        return real(automation, actions)

    mocker.patch.object(command.engine, "incomplete_run", side_effect=incomplete_run)
    out = StringIO()

    with pytest.raises(CommandError, match="2 enabled automation"):
        call_command("report_incomplete_automations", stdout=out)

    assert "could not be checked (RuntimeError)" in out.getvalue()
    assert str(second.id) in out.getvalue()
