# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import Project, ProjectMember, User


@pytest.fixture
def project(workspace):
    return Project.objects.create(
        workspace=workspace,
        name="Wiki Team A",
        identifier="TEAMA",
        external_source="confluence",
        external_id="1",
        network=0,
        issue_view=False,
    )


@pytest.fixture
def grantee(db):
    return User.objects.create(email="grantee@plane.so", username="grantee")


@pytest.mark.contract
@pytest.mark.django_db
class TestGrantConfluenceProjectAccess:
    def run(self, **overrides):
        output = StringIO()
        options = {"space": "TEAMA", "email": "grantee@plane.so", "role": 15, **overrides}
        call_command("grant_confluence_project_access", stdout=output, **options)
        return output.getvalue()

    def test_adds_a_member_at_the_requested_role(self, project, grantee):
        self.run(role=15)

        member = ProjectMember.objects.get(project=project, member=grantee)
        assert member.role == 15

    def test_updates_an_existing_members_role(self, project, grantee):
        ProjectMember.objects.create(project=project, member=grantee, role=5)

        self.run(role=20)

        member = ProjectMember.objects.get(project=project, member=grantee)
        assert member.role == 20

    def test_errors_on_an_unknown_space(self, project, grantee):
        with pytest.raises(CommandError):
            self.run(space="NOPE")

    def test_errors_on_an_unknown_email(self, project):
        with pytest.raises(CommandError):
            self.run(email="nobody@plane.so")
