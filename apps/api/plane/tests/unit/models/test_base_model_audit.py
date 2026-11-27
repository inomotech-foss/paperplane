# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from crum import impersonate
from django.contrib.auth.models import AnonymousUser

from plane.db.models import IssueActivity, Project, User, Workspace


@pytest.fixture
def other_user(db):
    return User.objects.create(email="other@plane.so", username="other")


@pytest.fixture
def project(workspace):
    return Project.objects.create(name="Audit", identifier="AUD", workspace=workspace)


def make_workspace(owner, **kwargs):
    return Workspace(name="Audit", slug="audit", owner=owner, **kwargs)


@pytest.mark.unit
@pytest.mark.django_db
class TestBaseModelAuditFields:
    def test_create_with_user_sets_both_fields(self, create_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save()

        workspace.refresh_from_db()
        assert workspace.created_by_id == create_user.id
        assert workspace.updated_by_id == create_user.id

    def test_create_without_user_keeps_explicit_creator(self, create_user):
        workspace = make_workspace(create_user, created_by=create_user)
        workspace.save()

        workspace.refresh_from_db()
        assert workspace.created_by_id == create_user.id
        assert workspace.updated_by_id == create_user.id

    def test_create_with_user_keeps_explicit_creator(self, create_user, other_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user, created_by=other_user)
            workspace.save()

        workspace.refresh_from_db()
        assert workspace.created_by_id == other_user.id
        assert workspace.updated_by_id == other_user.id

    def test_create_with_created_by_id_sets_both_fields(self, create_user, other_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save(created_by_id=other_user.id)

        workspace.refresh_from_db()
        assert workspace.created_by_id == other_user.id
        assert workspace.updated_by_id == other_user.id

    def test_update_without_user_keeps_both_fields(self, create_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save()

        workspace.name = "Renamed"
        workspace.save()

        workspace.refresh_from_db()
        assert workspace.name == "Renamed"
        assert workspace.created_by_id == create_user.id
        assert workspace.updated_by_id == create_user.id

    def test_update_with_user_sets_only_updated_by(self, create_user, other_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save()

        with impersonate(other_user):
            workspace.name = "Renamed"
            workspace.save()

        workspace.refresh_from_db()
        assert workspace.created_by_id == create_user.id
        assert workspace.updated_by_id == other_user.id

    def test_update_ignores_created_by_id(self, create_user, other_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save()
            workspace.save(created_by_id=other_user.id)

        workspace.refresh_from_db()
        assert workspace.created_by_id == create_user.id

    def test_disable_auto_set_user_on_update_leaves_fields_alone(self, create_user, other_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save()

        with impersonate(other_user):
            workspace.name = "Renamed"
            workspace.save(disable_auto_set_user=True)

        workspace.refresh_from_db()
        assert workspace.name == "Renamed"
        assert workspace.created_by_id == create_user.id
        assert workspace.updated_by_id == create_user.id

    def test_disable_auto_set_user_on_create_keeps_explicit_creator(self, create_user, other_user):
        with impersonate(other_user):
            workspace = make_workspace(create_user, created_by=create_user)
            workspace.save(disable_auto_set_user=True)

        workspace.refresh_from_db()
        assert workspace.created_by_id == create_user.id
        assert workspace.updated_by_id == create_user.id

    def test_create_without_user_or_creator_leaves_both_null(self, create_user):
        workspace = make_workspace(create_user)
        workspace.save()

        workspace.refresh_from_db()
        assert workspace.created_by_id is None
        assert workspace.updated_by_id is None

    def test_anonymous_user_counts_as_no_user(self, create_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save()

        with impersonate(AnonymousUser()):
            workspace.name = "Renamed"
            workspace.save()
            other = make_workspace(create_user)
            other.slug = "audit-anon"
            other.save()

        workspace.refresh_from_db()
        other.refresh_from_db()
        assert workspace.created_by_id == create_user.id
        assert workspace.updated_by_id == create_user.id
        assert other.created_by_id is None
        assert other.updated_by_id is None

    def test_update_fields_without_updated_by_keeps_the_stored_value(self, create_user, other_user):
        with impersonate(create_user):
            workspace = make_workspace(create_user)
            workspace.save()

        with impersonate(other_user):
            workspace.name = "Renamed"
            workspace.save(update_fields=["name"])

        workspace.refresh_from_db()
        assert workspace.name == "Renamed"
        assert workspace.updated_by_id == create_user.id


@pytest.mark.unit
@pytest.mark.django_db
class TestBulkCreateAuditFields:
    def _activity(self, project, **kwargs):
        return IssueActivity(project=project, workspace=project.workspace, verb="updated", **kwargs)

    def test_records_the_current_user(self, create_user, project):
        with impersonate(create_user):
            (activity,) = IssueActivity.objects.bulk_create([self._activity(project)])

        row = IssueActivity.objects.values("created_by_id", "updated_by_id").get(pk=activity.pk)
        assert row == {"created_by_id": create_user.id, "updated_by_id": create_user.id}

    def test_keeps_an_explicit_creator(self, create_user, other_user, project):
        with impersonate(create_user):
            (activity,) = IssueActivity.all_objects.bulk_create([self._activity(project, created_by=other_user)])

        row = IssueActivity.objects.values("created_by_id", "updated_by_id").get(pk=activity.pk)
        assert row == {"created_by_id": other_user.id, "updated_by_id": other_user.id}

    def test_without_a_user_leaves_the_creator_empty(self, project):
        (activity,) = IssueActivity.objects.bulk_create([self._activity(project)])

        assert IssueActivity.objects.values_list("created_by_id", flat=True).get(pk=activity.pk) is None
