# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import datetime

import pytest
from django.core import mail
from django.utils import timezone

from plane.bgtasks.email_notification_task import (
    create_payload,
    send_email_notification,
    send_page_mention_email,
    stack_email_notification,
)
from plane.db.models import EmailNotificationLog, Issue, Page, Project, State, User
from plane.license.models import InstanceConfiguration
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


def log_data(field="priority", activity_time="2026-10-12T10:00:00Z"):
    return {
        "issue_activity": {
            "field": field,
            "old_value": "none",
            "new_value": "high",
            "activity_time": activity_time,
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
def smtp(settings):
    settings.APP_BASE_URL = "https://plane.example.com"
    for key, value in {
        "EMAIL_TRANSPORT": "smtp",
        "EMAIL_HOST": "smtp.example.com",
        "EMAIL_PORT": "25",
        "EMAIL_FROM": "plane@example.com",
    }.items():
        InstanceConfiguration.objects.update_or_create(key=key, defaults={"value": value, "category": "SMTP"})


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

    send_page_mention_email(
        page_id=str(page.id),
        notification_data={str(create_user.id): [data]},
        receiver_id=str(receiver.id),
        email_notification_ids=[],
    )

    assert len(mail.outbox) == 1
    page_url = f"https://plane.example.com/{project.workspace.slug}/projects/{project.id}/pages/{page.id}"
    assert page_url in mail.outbox[0].alternatives[0][0]
    assert mail.outbox[0].subject == "You were mentioned in a comment on Runbook"


def test_a_page_body_mention_names_the_page_and_shows_the_snippet(project, receiver, create_user, smtp):
    page = Page.objects.create(name="Runbook", workspace=project.workspace, owned_by=create_user)
    data = {
        "page": {"id": str(page.id), "name": page.name, "project_id": str(project.id)},
        "mention": {"snippet": "@Victor please review"},
    }

    send_page_mention_email(
        page_id=str(page.id),
        notification_data={str(create_user.id): [data]},
        receiver_id=str(receiver.id),
        email_notification_ids=[],
    )

    assert mail.outbox[0].subject == "You were mentioned on Runbook"
    html = mail.outbox[0].alternatives[0][0]
    assert "@Victor please review" in html
    assert "in a comment" not in html


def test_payload_keeps_the_first_activity_time_per_actor():
    payload = create_payload(
        {
            "a": [log_data("priority", "2026-10-12T10:00:00Z"), log_data("state", "2026-10-12T11:30:00Z")],
            "b": [log_data("priority", "2026-10-12T12:00:00Z")],
        }
    )

    assert payload["a"]["activity_time"] == "2026-10-12 10:00:00"
    assert payload["b"]["activity_time"] == "2026-10-12 12:00:00"


def send_for(issue, receiver, actor):
    send_email_notification(
        issue_id=str(issue.id),
        notification_data={str(actor.id): [log_data()]},
        receiver_id=str(receiver.id),
        email_notification_ids=[],
    )
    return mail.outbox[-1].alternatives[0][0]


def test_an_absolute_avatar_url_is_used_as_is(project, receiver, create_user, smtp):
    create_user.avatar = "https://login.example.com/avatar.png"
    create_user.save(update_fields=["avatar"])

    html = send_for(make_issue(project, "Avatar"), receiver, create_user)

    assert 'src="https://login.example.com/avatar.png"' in html


def test_an_actor_without_an_avatar_gets_no_image(project, receiver, create_user, smtp):
    html = send_for(make_issue(project, "Initials"), receiver, create_user)

    assert "None" not in html
    assert f"> {create_user.first_name[0]} <" in html
