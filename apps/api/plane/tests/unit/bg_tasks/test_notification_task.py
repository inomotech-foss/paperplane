# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import uuid

import pytest

from plane.bgtasks.notification_task import notifications
from plane.db.models import (
    EmailNotificationLog,
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueSubscriber,
    Notification,
    Project,
    ProjectMember,
    State,
    User,
    UserNotificationPreference,
    WorkspaceMember,
)
from plane.utils.issue_type import link_starter_type
from plane.utils.notification_preference import notification_preference

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def no_celery(mocker):
    mocker.patch("plane.bgtasks.issue_activities_task.issue_activity.delay")


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Mentions", identifier="MEN", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


def add_member(project, email):
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=project.workspace, member=user, role=15, is_active=True)
    ProjectMember.objects.create(project=project, member=user, role=15, is_active=True)
    return user


@pytest.fixture
def mentioned(project):
    return add_member(project, "mentioned@plane.so")


@pytest.fixture
def issue(project, create_user):
    state = State.objects.create(
        name="Todo", group="unstarted", color="#000", project=project, workspace=project.workspace
    )
    return Issue.objects.create(
        name="Mention target", project=project, state=state, created_by=create_user, type=link_starter_type(project)
    )


def mention_html(user_id):
    return f'<p><mention-component entity_name="user_mention" entity_identifier="{user_id}"></mention-component></p>'


def run_description_mention(issue, actor, mentioned, activities):
    notifications(
        type="issue.activity.updated",
        issue_id=str(issue.id),
        project_id=str(issue.project_id),
        actor_id=str(actor.id),
        subscriber=False,
        issue_activities_created=json.dumps(activities),
        requested_data=json.dumps({"description_html": mention_html(mentioned.id)}),
        current_instance=json.dumps({"description_html": "<p></p>"}),
    )


def description_activity(issue, actor):
    return {
        "id": None,
        "verb": "updated",
        "field": "description",
        "actor_id": str(actor.id),
        "issue_detail": {"id": str(issue.id)},
        "issue_comment": None,
        "new_value": "",
        "old_value": "",
    }


def create_last_activity(issue, actor):
    return IssueActivity.objects.create(
        issue=issue,
        project=issue.project,
        workspace=issue.project.workspace,
        actor=actor,
        verb="updated",
        field="description",
    )


@pytest.mark.parametrize("with_last_activity", [True, False])
def test_description_mention_emails_the_mentioned_user(issue, create_user, mentioned, with_last_activity):
    watcher = add_member(issue.project, "watcher@plane.so")
    IssueSubscriber.objects.create(
        project=issue.project, workspace=issue.project.workspace, issue=issue, subscriber=watcher
    )
    if with_last_activity:
        create_last_activity(issue, create_user)

    run_description_mention(issue, create_user, mentioned, [description_activity(issue, create_user)])

    receivers = set(EmailNotificationLog.objects.values_list("receiver_id", flat=True))
    assert receivers == {mentioned.id}


@pytest.mark.parametrize("with_last_activity", [True, False])
def test_description_mention_without_other_subscribers(issue, create_user, mentioned, with_last_activity):
    if with_last_activity:
        create_last_activity(issue, create_user)

    run_description_mention(issue, create_user, mentioned, [description_activity(issue, create_user)])

    assert list(EmailNotificationLog.objects.values_list("receiver_id", flat=True)) == [mentioned.id]
    assert Notification.objects.filter(receiver=mentioned, sender="in_app:issue_activities:mentioned").exists()


def test_description_mention_without_activities_in_the_payload(issue, create_user, mentioned):
    create_last_activity(issue, create_user)

    run_description_mention(issue, create_user, mentioned, [])

    assert Notification.objects.filter(receiver=mentioned, sender="in_app:issue_activities:mentioned").exists()
    assert list(EmailNotificationLog.objects.values_list("receiver_id", flat=True)) == [mentioned.id]


def activity(issue, actor, field, new_identifier=None, new_value=""):
    return {
        "id": None,
        "verb": "updated",
        "field": field,
        "comment": f"updated the {field}",
        "actor_id": str(actor.id),
        "issue_detail": {"id": str(issue.id)},
        "issue_comment": None,
        "new_value": new_value,
        "old_value": "",
        "new_identifier": str(new_identifier) if new_identifier else None,
        "created_at": "2026-10-12T10:00:00Z",
    }


def run_change(issue, actor, activities, type="issue.activity.updated"):
    notifications(
        type=type,
        issue_id=str(issue.id),
        project_id=str(issue.project_id),
        actor_id=str(actor.id),
        subscriber=False,
        issue_activities_created=json.dumps(activities),
        requested_data=json.dumps({}),
        current_instance=json.dumps({}),
    )


@pytest.fixture
def watcher(issue):
    user = add_member(issue.project, "watcher@plane.so")
    IssueSubscriber.objects.create(
        project=issue.project, workspace=issue.project.workspace, issue=issue, subscriber=user
    )
    return user


def make_state(project, group):
    return State.objects.create(name=group, group=group, color="#000", project=project, workspace=project.workspace)


@pytest.mark.parametrize(
    "preferences, field, state_group, emailed",
    [
        ({"state_change": False}, "state", "started", False),
        ({"state_change": False, "issue_completed": False}, "state", "completed", False),
        ({"state_change": False}, "state", "completed", True),
        ({"issue_completed": False}, "state", "started", True),
        ({"property_change": False}, "state", "started", True),
        ({"comment": False}, "comment", None, False),
        ({"property_change": False}, "comment", None, True),
        ({"property_change": False}, "priority", None, False),
        ({"state_change": False, "comment": False}, "priority", None, True),
    ],
)
def test_each_activity_is_gated_by_its_own_preference(
    issue, create_user, watcher, preferences, field, state_group, emailed
):
    UserNotificationPreference.objects.filter(user=watcher).update(**preferences)
    new_identifier = make_state(issue.project, state_group).id if state_group else None

    run_change(issue, create_user, [activity(issue, create_user, field, new_identifier)])

    assert EmailNotificationLog.objects.filter(receiver=watcher).exists() == emailed
    assert Notification.objects.filter(receiver=watcher).count() == 1


def test_a_missing_preference_row_uses_the_defaults(issue, create_user, watcher, mentioned):
    UserNotificationPreference.objects.filter(user__in=[watcher, mentioned]).delete()
    comment = activity(issue, create_user, "comment", new_value=mention_html(mentioned.id))
    comment["issue_comment"] = str(uuid.uuid4())

    run_change(issue, create_user, [comment], type="comment.activity.created")

    assert Notification.objects.filter(receiver=watcher).exists()
    assert Notification.objects.filter(receiver=mentioned).exists()
    assert set(EmailNotificationLog.objects.values_list("receiver_id", flat=True)) == {watcher.id, mentioned.id}


def test_a_failure_is_logged(issue, create_user, watcher, mocker):
    log = mocker.patch("plane.bgtasks.notification_task.log_exception")

    run_change(issue, create_user, [{"field": "priority"}])

    log.assert_called_once()


def add_outsider(issue, email, assigned=True, workspace_active=True, user_active=True):
    user = User.objects.create(email=email, username=email.split("@")[0], is_active=user_active)
    WorkspaceMember.objects.create(workspace=issue.workspace, member=user, role=15, is_active=workspace_active)
    IssueSubscriber.objects.create(project=issue.project, workspace=issue.workspace, issue=issue, subscriber=user)
    if assigned:
        IssueAssignee.objects.create(project=issue.project, workspace=issue.workspace, issue=issue, assignee=user)
    return user


def test_an_assignee_outside_the_project_is_still_notified(issue, create_user):
    assignee = add_outsider(issue, "former@plane.so")

    run_change(issue, create_user, [activity(issue, create_user, "priority")])

    assert Notification.objects.filter(receiver=assignee, sender="in_app:issue_activities:assigned").exists()
    assert EmailNotificationLog.objects.filter(receiver=assignee).exists()


@pytest.mark.parametrize(
    "options",
    [{"assigned": False}, {"workspace_active": False}, {"user_active": False}],
    ids=["only-subscribed", "left-the-workspace", "deactivated"],
)
def test_other_users_outside_the_project_are_not_notified(issue, create_user, options):
    outsider = add_outsider(issue, "outsider@plane.so", **options)

    run_change(issue, create_user, [activity(issue, create_user, "priority")])

    assert not Notification.objects.filter(receiver=outsider).exists()
    assert not EmailNotificationLog.objects.filter(receiver=outsider).exists()


def test_a_bot_without_a_preference_row_gets_no_email(issue, create_user):
    bot = add_member(issue.project, "bot@plane.so")
    User.objects.filter(pk=bot.pk).update(is_bot=True)
    UserNotificationPreference.objects.filter(user=bot).delete()
    IssueSubscriber.objects.create(project=issue.project, workspace=issue.workspace, issue=issue, subscriber=bot)

    run_change(issue, create_user, [activity(issue, create_user, "priority")])

    assert not EmailNotificationLog.objects.filter(receiver=bot).exists()


def test_a_bot_with_a_preference_row_follows_it(create_user):
    bot = User.objects.create(email="bot@plane.so", username="bot", is_bot=True)
    UserNotificationPreference.objects.create(user=bot, mention=True, comment=False)

    preference = notification_preference(bot.id)
    assert (preference.mention, preference.comment) == (True, False)


def test_an_assignee_outside_a_secret_project_is_not_notified(issue, create_user):
    Project.objects.filter(pk=issue.project_id).update(network=0)
    assignee = add_outsider(issue, "former@plane.so")

    run_change(issue, create_user, [activity(issue, create_user, "priority")])

    assert not Notification.objects.filter(receiver=assignee).exists()
    assert not EmailNotificationLog.objects.filter(receiver=assignee).exists()
