# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from crum import impersonate

from plane.db.models import User, Workspace


@pytest.fixture
def other_user(db):
    return User.objects.create(email="other@plane.so", username="other")


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
