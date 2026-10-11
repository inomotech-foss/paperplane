# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for merging one user into another.
"""

import pytest
from django.utils import timezone

from plane.db.models import (
    Account,
    Issue,
    IssueAssignee,
    Profile,
    Project,
    ProjectMember,
    State,
    User,
    UserFavorite,
    UserNotificationPreference,
    Workspace,
    WorkspaceMember,
)
from plane.license.models import Instance, InstanceAdmin
from plane.license.utils.user_lifecycle import deleted_email, soft_delete_user
from plane.license.utils.user_merge import MergeError, merge_users
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def survivor(db):
    return User.objects.create(email="survivor@plane.so", username="survivor")


@pytest.fixture
def source(db):
    return User.objects.create(email="source@plane.so", username="source", is_email_verified=True)


@pytest.fixture
def owner(db):
    return User.objects.create(email="owner@plane.so", username="owner")


@pytest.fixture
def workspace(owner):
    workspace = Workspace.objects.create(name="W", slug="w", owner=owner)
    WorkspaceMember.objects.create(workspace=workspace, member=owner, role=20)
    return workspace


@pytest.fixture
def project(workspace, owner):
    project = Project.objects.create(name="P", identifier="P", workspace=workspace, created_by=owner)
    ProjectMember.objects.create(project=project, member=owner, workspace=workspace, role=20)
    return project


@pytest.fixture
def issue(project, workspace, owner):
    state = State.objects.create(name="Todo", project=project, group="backlog", default=True)
    return Issue.objects.create(
        name="I", workspace=workspace, project=project, state=state, created_by=owner, type=link_starter_type(project)
    )


def account(user, provider, account_id):
    return Account.objects.create(user=user, provider=provider, provider_account_id=account_id, access_token="t")


@pytest.mark.unit
class TestMergeUsers:
    @pytest.mark.django_db
    def test_shared_workspace_keeps_the_higher_role(self, survivor, source, workspace):
        WorkspaceMember.objects.create(workspace=workspace, member=survivor, role=5, is_active=False)
        WorkspaceMember.objects.create(workspace=workspace, member=source, role=20)

        result = merge_users(survivor, source)

        kept = WorkspaceMember.objects.get(workspace=workspace, member=survivor)
        assert kept.role == 20
        assert kept.is_active is True
        assert not WorkspaceMember.all_objects.filter(member=source).exists()
        assert result["relations"]["db.WorkspaceMember.member"] == {"moved": 0, "dropped": 1}

    @pytest.mark.django_db
    def test_a_membership_only_the_source_has_moves_over(self, survivor, source, workspace, project):
        WorkspaceMember.objects.create(workspace=workspace, member=source, role=15)
        ProjectMember.objects.create(project=project, member=source, workspace=workspace, role=15)

        result = merge_users(survivor, source)

        assert WorkspaceMember.objects.get(workspace=workspace, member=survivor).role == 15
        assert ProjectMember.objects.get(project=project, member=survivor).role == 15
        assert result["relations"]["db.ProjectMember.member"] == {"moved": 1, "dropped": 0}

    @pytest.mark.django_db
    def test_assignee_through_rows_are_repointed_without_duplicates(self, survivor, source, issue, project, workspace):
        other = Issue.objects.create(
            name="J", workspace=workspace, project=project, state=issue.state, type=link_starter_type(project)
        )
        IssueAssignee.objects.create(issue=issue, assignee=source, project=project, workspace=workspace)
        IssueAssignee.objects.create(issue=issue, assignee=survivor, project=project, workspace=workspace)
        IssueAssignee.objects.create(issue=other, assignee=source, project=project, workspace=workspace)

        result = merge_users(survivor, source)

        assert set(issue.assignees.values_list("id", flat=True)) == {survivor.id}
        assert set(other.assignees.values_list("id", flat=True)) == {survivor.id}
        assert result["relations"]["db.IssueAssignee.assignee"] == {"moved": 1, "dropped": 1}

    @pytest.mark.django_db
    def test_audit_columns_follow_the_survivor(self, survivor, source, workspace):
        project = Project.objects.create(name="Q", identifier="Q", workspace=workspace)
        # save() overwrites the audit fields from the request user.
        Project.objects.filter(pk=project.pk).update(created_by=source, updated_by=source)

        result = merge_users(survivor, source)

        project.refresh_from_db()
        assert project.created_by == survivor
        assert project.updated_by == survivor
        assert result["relations"]["db.Project.created_by"] == {"moved": 1, "dropped": 0}

    @pytest.mark.django_db
    def test_instance_admin_rows_collapse(self, survivor, source):
        instance = Instance.objects.create(
            instance_name="i", instance_id="i", current_version="1", latest_version="1", last_checked_at=timezone.now()
        )
        InstanceAdmin.objects.create(instance=instance, user=survivor, role=20)
        InstanceAdmin.objects.create(instance=instance, user=source, role=20)

        merge_users(survivor, source)

        assert InstanceAdmin.objects.filter(instance=instance).count() == 1
        assert InstanceAdmin.objects.get(instance=instance).user == survivor

    @pytest.mark.django_db
    def test_duplicate_favorites_are_dropped(self, survivor, source, workspace, project):
        UserFavorite.objects.create(
            user=source, workspace=workspace, entity_type="project", entity_identifier=project.id
        )
        UserFavorite.objects.create(
            user=survivor, workspace=workspace, entity_type="project", entity_identifier=project.id
        )
        UserFavorite.objects.create(user=source, workspace=workspace, entity_type="view", entity_identifier=project.id)

        result = merge_users(survivor, source)

        assert UserFavorite.objects.filter(user=survivor).count() == 2
        assert not UserFavorite.all_objects.filter(user=source).exists()
        assert result["relations"]["db.UserFavorite.user"] == {"moved": 1, "dropped": 1}

    @pytest.mark.django_db
    def test_notification_preferences_stay_one_per_scope(self, survivor, source, workspace):
        # Both users got a global preference row on creation.
        UserNotificationPreference.objects.create(user=source, workspace=workspace)

        result = merge_users(survivor, source)

        assert UserNotificationPreference.objects.filter(user=survivor, workspace__isnull=True).count() == 1
        assert UserNotificationPreference.objects.filter(user=survivor, workspace=workspace).count() == 1
        assert not UserNotificationPreference.all_objects.filter(user=source).exists()
        assert result["relations"]["db.UserNotificationPreference.user"] == {"moved": 1, "dropped": 1}

    @pytest.mark.django_db
    def test_accounts_move_unless_the_provider_is_taken(self, survivor, source):
        account(survivor, "google", "g-survivor")
        account(source, "google", "g-source")
        account(source, "github", "gh-source")

        result = merge_users(survivor, source)

        providers = dict(Account.objects.filter(user=survivor).values_list("provider", "provider_account_id"))
        assert providers == {"google": "g-survivor", "github": "gh-source"}
        assert not Account.objects.filter(user=source).exists()
        assert result["relations"]["db.Account.user"] == {"moved": 1, "dropped": 1}

    @pytest.mark.django_db
    def test_source_is_anonymised_and_points_at_the_survivor(self, survivor, source):
        source.first_name = "Sam"
        source.save()

        merge_users(survivor, source)

        source.refresh_from_db()
        assert source.deleted_at is not None
        assert source.merged_into == survivor
        assert source.is_active is False
        assert source.email == deleted_email(source.id)
        assert source.first_name == ""
        survivor.refresh_from_db()
        assert survivor.email == "survivor@plane.so"
        assert survivor.is_email_verified is True

    @pytest.mark.django_db
    def test_keep_source_email(self, survivor, source):
        result = merge_users(survivor, source, keep_source_email=True)

        survivor.refresh_from_db()
        assert survivor.email == "source@plane.so"
        assert result["email"] == "source@plane.so"
        assert User.objects.filter(email="source@plane.so").count() == 1

    @pytest.mark.django_db
    def test_survivor_profile_is_kept(self, survivor, source):
        Profile.objects.create(user=survivor, role="keeper")
        Profile.objects.create(user=source, role="gone")

        merge_users(survivor, source)

        assert Profile.objects.get(user=survivor).role == "keeper"

    @pytest.mark.django_db
    def test_preview_writes_nothing(self, survivor, source, workspace):
        WorkspaceMember.objects.create(workspace=workspace, member=source, role=15)
        account(source, "google", "g-source")

        result = merge_users(survivor, source, dry_run=True)

        assert result["relations"]["db.WorkspaceMember.member"] == {"moved": 1, "dropped": 0}
        assert result["relations"]["db.Account.user"] == {"moved": 1, "dropped": 0}
        source.refresh_from_db()
        assert source.deleted_at is None
        assert source.email == "source@plane.so"
        assert WorkspaceMember.objects.get(workspace=workspace, member=source).role == 15
        assert Account.objects.get(user=source).provider == "google"
        assert not WorkspaceMember.objects.filter(member=survivor).exists()

    @pytest.mark.django_db
    def test_refusals(self, survivor, source, owner):
        with pytest.raises(MergeError):
            merge_users(survivor, survivor)
        with pytest.raises(MergeError):
            merge_users(survivor, source, actor=source)

        bot = User.objects.create(email="bot@plane.so", username="bot", is_bot=True)
        with pytest.raises(MergeError):
            merge_users(survivor, bot)
        with pytest.raises(MergeError):
            merge_users(bot, source)

        soft_delete_user(owner)
        with pytest.raises(MergeError):
            merge_users(survivor, owner)
        with pytest.raises(MergeError):
            merge_users(owner, source)
        assert source.deleted_at is None
