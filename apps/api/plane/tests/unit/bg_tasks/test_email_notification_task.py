# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import datetime

import pytest
from django.core import mail
from django.utils import timezone

from plane.bgtasks.email_notification_task import (
    send_email_notification,
    send_page_comment_mention_email,
    stack_email_notification,
)
from plane.db.models import EmailNotificationLog, Issue, Page, Project, State, User
from plane.utils.issue_type import link_starter_type

pytestmark = pytest.mark.unit


@pytest.fixture
def project(db, workspace, create_user):
    return Project.objects.create(name="Mail", identifier="MAIL", workspace=workspace, created_by=create_user)


def make_issue(project, name):
    state = State.objects.create(
        name=name, group="unstarted", color="#000", project=project, workspace=project.workspace
    )
    return Issue.objects.create(name=name, project=project, state=state, type=link_starter_type(project))


@pytest.fixture
def receiver(db):
    return User.objects.create(email="receiver@plane.so", username="receiver")


def log_data(field="priority"):
    return {
        "issue_activity": {
            "field": field,
            "old_value": "none",
            "new_value": "high",
            "activity_time": "2026-10-12T10:00:00Z",
        }
    }


def make_log(issue, receiver, actor):
    return EmailNotificationLog.objects.create(
        receiver=receiver,
        triggered_by=actor,
        entity_identifier=issue.id,
        entity_name="issue",
        data=log_data(),
    )


def test_each_issue_is_sent_with_only_its_own_logs(project, receiver, create_user, mocker):
    send = mocker.patch("plane.bgtasks.email_notification_task.send_email_notification.delay")
    first, second = make_issue(project, "First"), make_issue(project, "Second")
    first_logs = {make_log(first, receiver, create_user).id, make_log(first, receiver, create_user).id}
    second_logs = {make_log(second, receiver, create_user).id}

    stack_email_notification()

    sent = {call.kwargs["issue_id"]: set(call.kwargs["email_notification_ids"]) for call in send.call_args_list}
    assert sent == {first.id: first_logs, second.id: second_logs}
    assert not EmailNotificationLog.objects.filter(processed_at__isnull=True).exists()


def test_logs_older_than_a_day_are_dropped(project, receiver, create_user, mocker):
    send = mocker.patch("plane.bgtasks.email_notification_task.send_email_notification.delay")
    issue = make_issue(project, "Backlog")
    stale = make_log(issue, receiver, create_user)
    EmailNotificationLog.objects.filter(pk=stale.pk).update(created_at=timezone.now() - datetime.timedelta(days=2))

    stack_email_notification()

    send.assert_not_called()
    stale.refresh_from_db()
    assert stale.processed_at is not None
    assert stale.sent_at is None


@pytest.fixture
def smtp(mocker, settings):
    settings.APP_BASE_URL = "https://plane.example.com"
    mocker.patch(
        "plane.bgtasks.email_notification_task.get_email_configuration",
        return_value=("smtp.example.com", "", "", "25", "0", "0", "plane@example.com"),
    )


def test_sends_without_a_request_origin_and_marks_only_its_logs(project, receiver, create_user, smtp):
    issue, other = make_issue(project, "Automated"), make_issue(project, "Other")
    sent_log, other_log = make_log(issue, receiver, create_user), make_log(other, receiver, create_user)

    send_email_notification(
        issue_id=str(issue.id),
        notification_data={str(create_user.id): [log_data()]},
        receiver_id=str(receiver.id),
        email_notification_ids=[str(sent_log.id)],
    )

    assert len(mail.outbox) == 1
    assert (
        f"https://plane.example.com/{project.workspace.slug}/projects/{project.id}/issues/{issue.id}"
        in (mail.outbox[0].alternatives[0][0])
    )
    sent_log.refresh_from_db()
    other_log.refresh_from_db()
    assert sent_log.sent_at is not None
    assert other_log.sent_at is None


def test_a_page_mention_links_to_the_configured_app_url(project, receiver, create_user, smtp):
    page = Page.objects.create(name="Runbook", workspace=project.workspace, owned_by=create_user)
    data = {
        "page": {"id": str(page.id), "name": page.name, "project_id": str(project.id)},
        "comment": {"snippet": "hi"},
    }

    send_page_comment_mention_email(
        page_id=str(page.id),
        notification_data={str(create_user.id): [data]},
        receiver_id=str(receiver.id),
        email_notification_ids=[],
    )

    assert len(mail.outbox) == 1
    page_url = f"https://plane.example.com/{project.workspace.slug}/projects/{project.id}/pages/{page.id}"
    assert page_url in mail.outbox[0].alternatives[0][0]
