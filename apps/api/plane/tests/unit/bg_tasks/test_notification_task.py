# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.bgtasks.notification_task import notifications
from plane.db.models import (
    EmailNotificationLog,
    Issue,
    IssueActivity,
    IssueSubscriber,
    Notification,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)
from plane.utils.issue_type import link_starter_type

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
