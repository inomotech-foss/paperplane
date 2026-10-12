# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import importlib

import pytest
from django.db import connection
from django.utils import timezone

from plane.db.models import Issue, IssueAssignee, IssueSubscriber, Project, User
from plane.utils.issue_type import link_starter_type

backfill = importlib.import_module("plane.db.migrations.0152_subscribe_assignees")

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    return Project.objects.create(name="Import", identifier="IMP", workspace=workspace, created_by=create_user)


def make_issue(project, name):
    return Issue.objects.create(name=name, project=project, type=link_starter_type(project))


def assign(issue, user):
    return IssueAssignee.objects.create(issue=issue, assignee=user, project=issue.project)


def subscribe(issue, user):
    return IssueSubscriber.objects.create(issue=issue, subscriber=user, project=issue.project)


def make_user(name):
    return User.objects.create(email=f"{name}@plane.so", username=name)


def run_backfill():
    with connection.cursor() as cursor:
        cursor.execute(backfill.SUBSCRIBE_ASSIGNEES)


def subscriptions(issue, user):
    return list(IssueSubscriber.all_objects.filter(issue=issue, subscriber=user).values_list("deleted_at", flat=True))


def test_assignees_without_a_subscription_are_subscribed(project):
    ada, bob = make_user("ada"), make_user("bob")
    issue = make_issue(project, "Imported")
    assign(issue, ada)
    assign(issue, bob)
    subscribe(issue, bob)

    run_backfill()

    assert subscriptions(issue, ada) == [None]
    assert subscriptions(issue, bob) == [None]
    assert IssueSubscriber.objects.get(issue=issue, subscriber=ada).workspace_id == project.workspace_id


def test_an_unsubscribed_assignee_stays_unsubscribed(project):
    ada = make_user("ada")
    issue = make_issue(project, "Muted")
    assign(issue, ada)
    unsubscribed_at = timezone.now()
    IssueSubscriber.objects.filter(pk=subscribe(issue, ada).pk).update(deleted_at=unsubscribed_at)

    run_backfill()

    assert subscriptions(issue, ada) == [unsubscribed_at]


def test_removed_assignees_and_deleted_items_are_skipped(project):
    ada = make_user("ada")
    unassigned, deleted = make_issue(project, "Unassigned"), make_issue(project, "Deleted")
    IssueAssignee.objects.filter(pk=assign(unassigned, ada).pk).update(deleted_at=timezone.now())
    assign(deleted, ada)
    Issue.all_objects.filter(pk=deleted.pk).update(deleted_at=timezone.now())

    run_backfill()

    assert not IssueSubscriber.all_objects.filter(subscriber=ada).exists()
