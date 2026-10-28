# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from django.utils import timezone

from plane.bgtasks.page_mention_task import MENTION_DELAY, notify_page_mentions
from plane.bgtasks.page_transaction_task import page_transaction
from plane.db.models import (
    EmailNotificationLog,
    Notification,
    Page,
    PageLog,
    Project,
    ProjectMember,
    ProjectPage,
    User,
    UserNotificationPreference,
)

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Nova", identifier="NOVA", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture
def page(project, create_user):
    page = Page.objects.create(name="Meeting notes", workspace=project.workspace, owned_by=create_user)
    ProjectPage.objects.create(page=page, project=project, workspace=project.workspace)
    return page


@pytest.fixture
def member(project):
    user = User.objects.create(email="victor@plane.so", username="victor", display_name="victor")
    ProjectMember.objects.create(project=project, member=user, role=15)
    return user


def mention(user, transaction=None, author=None):
    author_attr = f' author="{author.id}"' if author else ""
    return (
        f'<mention-component id="{transaction or uuid.uuid4()}" entity_identifier="{user.id}" '
        f'entity_name="user_mention"{author_attr}></mention-component>'
    )


def edit(page, actor, html):
    old = page.description_html
    Page.objects.filter(pk=page.pk).update(description_html=html)
    page.description_html = html
    page_transaction(html, old, page.id, actor_id=str(actor.id) if actor else None)


def age_logs():
    PageLog.objects.update(created_at=timezone.now() - MENTION_DELAY)


def test_a_new_mention_notifies_after_the_delay(page, create_user, member):
    edit(page, create_user, f"<p>{mention(member)} please review</p>")

    notify_page_mentions()
    assert not Notification.objects.exists()

    age_logs()
    notify_page_mentions()

    notification = Notification.objects.get(receiver=member)
    assert notification.entity_identifier == page.id
    assert notification.triggered_by == create_user
    assert notification.message_stripped == "@victor please review"
    assert "comment" not in notification.data
    log = EmailNotificationLog.objects.get(receiver=member)
    assert log.data["mention"]["snippet"] == "@victor please review"


def test_a_mention_removed_within_the_delay_notifies_no_one(page, create_user, member):
    edit(page, create_user, f"<p>{mention(member)}</p>")
    edit(page, create_user, "<p>never mind</p>")

    age_logs()
    notify_page_mentions()

    assert not Notification.objects.exists()


def test_several_mentions_of_one_user_notify_once(page, create_user, member):
    edit(page, create_user, f"<p>{mention(member)}</p>")
    edit(page, create_user, f"{page.description_html}<p>{mention(member)}</p>")

    age_logs()
    notify_page_mentions()
    notify_page_mentions()

    assert Notification.objects.filter(receiver=member).count() == 1
    assert not PageLog.objects.filter(notified_at__isnull=True).exists()


def test_existing_mentions_without_logs_do_not_notify(page, create_user, member):
    old = f"<p>{mention(member)}</p>"
    Page.objects.filter(pk=page.pk).update(description_html=old)
    page.description_html = old

    edit(page, create_user, f"{old}<p>more</p>")
    age_logs()
    notify_page_mentions()

    assert PageLog.objects.filter(page=page).count() == 1
    assert not Notification.objects.exists()


def test_saves_without_an_actor_do_not_notify(page, member):
    edit(page, None, f"<p>{mention(member)}</p>")

    age_logs()
    notify_page_mentions()

    assert not Notification.objects.exists()


def test_self_mentions_do_not_notify(page, create_user):
    edit(page, create_user, f"<p>{mention(create_user)}</p>")

    age_logs()
    notify_page_mentions()

    assert not Notification.objects.exists()


def test_users_outside_the_project_are_not_notified(page, create_user):
    outsider = User.objects.create(email="outsider@plane.so", username="outsider")
    edit(page, create_user, f"<p>{mention(outsider)}</p>")

    age_logs()
    notify_page_mentions()

    assert not Notification.objects.exists()


def test_no_email_when_mention_emails_are_off(page, create_user, member):
    UserNotificationPreference.objects.update_or_create(user=member, defaults={"mention": False})
    edit(page, create_user, f"<p>{mention(member)}</p>")

    age_logs()
    notify_page_mentions()

    assert Notification.objects.filter(receiver=member).exists()
    assert not EmailNotificationLog.objects.exists()


def test_private_pages_only_notify_their_owner(page, create_user, member):
    Page.objects.filter(pk=page.pk).update(access=Page.PRIVATE_ACCESS)
    edit(page, create_user, f"<p>{mention(member)}</p>")

    age_logs()
    notify_page_mentions()

    assert not Notification.objects.exists()


def test_a_mention_restored_after_removal_still_notifies(page, create_user, member):
    transaction = uuid.uuid4()
    edit(page, create_user, f"<p>{mention(member, transaction)}</p>")
    edit(page, create_user, "<p></p>")
    edit(page, create_user, f"<p>{mention(member, transaction)}</p>")

    age_logs()
    notify_page_mentions()

    assert Notification.objects.filter(receiver=member).count() == 1


def test_removing_a_mention_leaves_other_pages_alone(page, project, create_user, member):
    transaction = uuid.uuid4()
    copy = Page.objects.create(name="Copy", workspace=project.workspace, owned_by=create_user)
    ProjectPage.objects.create(page=copy, project=project, workspace=project.workspace)
    edit(page, create_user, f"<p>{mention(member, transaction)}</p>")
    edit(copy, create_user, f"<p>{mention(member, transaction)}</p>")
    edit(copy, create_user, "<p></p>")

    age_logs()
    notify_page_mentions()

    assert list(Notification.objects.values_list("entity_identifier", flat=True)) == [page.id]


def test_a_newer_mention_of_the_same_user_restarts_the_delay(page, create_user, member):
    edit(page, create_user, f"<p>{mention(member)}</p>")
    age_logs()
    edit(page, create_user, f"{page.description_html}<p>{mention(member)}</p>")

    notify_page_mentions()
    assert not Notification.objects.exists()

    age_logs()
    notify_page_mentions()
    assert Notification.objects.filter(receiver=member).count() == 1


def test_a_mention_no_longer_in_the_page_does_not_notify(page, create_user, member):
    edit(page, create_user, f"<p>{mention(member)}</p>")
    Page.objects.filter(pk=page.pk).update(description_html="<p></p>")

    age_logs()
    notify_page_mentions()

    assert not Notification.objects.exists()


def test_archived_projects_are_skipped_for_another_project(page, project, create_user, member):
    other = Project.objects.create(name="Other", identifier="OTH", workspace=project.workspace, created_by=create_user)
    ProjectMember.objects.create(project=other, member=member, role=15)
    ProjectPage.objects.create(page=page, project=other, workspace=project.workspace)
    Project.objects.filter(pk=project.pk).update(archived_at=timezone.now())
    edit(page, create_user, f"<p>{mention(member)}</p>")

    age_logs()
    notify_page_mentions()

    assert Notification.objects.get(receiver=member).project_id == other.id


def test_the_mention_author_is_the_sender_even_if_someone_else_saved(page, create_user, member):
    edit(page, member, f"<p>{mention(member, author=create_user)}</p>")

    age_logs()
    notify_page_mentions()

    assert Notification.objects.get(receiver=member).triggered_by == create_user


def test_an_author_outside_the_workspace_falls_back_to_the_saver(page, create_user, member):
    outsider = User.objects.create(email="outsider@plane.so", username="outsider")
    edit(page, create_user, f"<p>{mention(member, author=outsider)}</p>")

    age_logs()
    notify_page_mentions()

    assert Notification.objects.get(receiver=member).triggered_by == create_user
