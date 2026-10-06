# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from plane.authentication.utils.workspace_project_join import process_workspace_project_invitations
from plane.db.models import (
    Project,
    ProjectMember,
    ProjectMemberInvite,
    ProjectUserProperty,
    User,
    Workspace,
    WorkspaceMemberInvite,
)
from plane.utils.project_sort_order import create_missing_project_user_properties


def _projects(workspace, names):
    return [Project.objects.create(name=n, identifier=n[:5].upper(), workspace=workspace) for n in names]


def _orders(user, workspace):
    props = ProjectUserProperty.objects.filter(user=user, workspace=workspace).select_related("project")
    return {p.project.name: p.sort_order for p in props}


@pytest.mark.unit
@pytest.mark.django_db
class TestCreateMissingProjectUserProperties:
    def test_new_projects_are_alphabetical_with_step(self, workspace, create_user):
        projects = _projects(workspace, ["cherry", "Apple", "banana"])

        create_missing_project_user_properties(create_user, workspace, projects)

        assert _orders(create_user, workspace) == {"Apple": 45535, "banana": 55535, "cherry": 65535}

    def test_new_projects_go_above_existing_ones(self, workspace, create_user):
        old, *new = _projects(workspace, ["zeta", "beta", "alpha"])
        ProjectUserProperty.objects.create(project=old, user=create_user, workspace=workspace, sort_order=5000)

        create_missing_project_user_properties(create_user, workspace, new)

        assert _orders(create_user, workspace) == {"zeta": 5000, "beta": -5000, "alpha": -15000}

    def test_existing_rows_are_left_alone(self, workspace, create_user):
        first, second = _projects(workspace, ["one", "two"])
        ProjectUserProperty.objects.create(project=first, user=create_user, workspace=workspace, sort_order=7)

        create_missing_project_user_properties(create_user, workspace, [first, second])

        assert _orders(create_user, workspace) == {"one": 7, "two": -9993}

    def test_no_projects_is_a_noop(self, workspace, create_user):
        create_missing_project_user_properties(create_user, workspace, [])

        assert not ProjectUserProperty.objects.filter(user=create_user).exists()


@pytest.mark.unit
@pytest.mark.django_db
class TestProcessWorkspaceProjectInvitations:
    def test_accepted_project_invites_create_members_and_ordered_properties(self, workspace, create_user):
        beta, alpha = _projects(workspace, ["beta", "alpha"])
        for project in (beta, alpha):
            ProjectMemberInvite.objects.create(
                project=project, workspace=workspace, email=create_user.email, token=project.name, accepted=True
            )

        process_workspace_project_invitations(create_user)

        assert set(ProjectMember.objects.filter(member=create_user).values_list("project_id", flat=True)) == {
            beta.id,
            alpha.id,
        }
        orders = _orders(create_user, workspace)
        assert orders["alpha"] < orders["beta"]

    def test_workspace_only_invites_are_unaffected(self, workspace, create_user):
        WorkspaceMemberInvite.objects.create(workspace=workspace, email=create_user.email, accepted=True, token="t")

        process_workspace_project_invitations(create_user)

        assert not ProjectUserProperty.objects.filter(user=create_user).exists()


@pytest.mark.unit
@pytest.mark.django_db
class TestReorderProjectSidebarCommand:
    @pytest.fixture
    def scrambled(self, workspace, create_user):
        for project in _projects(workspace, ["charlie", "Alpha", "bravo"]):
            ProjectUserProperty.objects.create(project=project, user=create_user, workspace=workspace)
        return workspace

    def test_dry_run_changes_nothing(self, scrambled, create_user):
        out = StringIO()
        call_command("reorder_project_sidebar", "--email", create_user.email, stdout=out)

        assert set(_orders(create_user, scrambled).values()) == {65535}
        assert "dry run" in out.getvalue()
        assert "Alpha: 65535.0 -> 10000" in out.getvalue()

    def test_commit_sorts_alphabetically_per_workspace(self, scrambled, create_user):
        other = Workspace.objects.create(name="Other", slug="other", owner=create_user)
        for project in _projects(other, ["yak", "xray"]):
            ProjectUserProperty.objects.create(project=project, user=create_user, workspace=other, sort_order=1)

        call_command("reorder_project_sidebar", "--email", create_user.email, "--no-dry-run", stdout=StringIO())

        assert _orders(create_user, scrambled) == {"Alpha": 10000, "bravo": 20000, "charlie": 30000}
        assert _orders(create_user, other) == {"xray": 10000, "yak": 20000}

    def test_all_users_covers_other_users(self, scrambled):
        other_user = User.objects.create(email="other@plane.so", username="other")
        project = Project.objects.create(name="aaa", identifier="AAA", workspace=scrambled)
        ProjectUserProperty.objects.create(project=project, user=other_user, workspace=scrambled, sort_order=3)

        call_command("reorder_project_sidebar", "--all-users", "--no-dry-run", stdout=StringIO())

        assert _orders(other_user, scrambled) == {"aaa": 10000}

    def test_unknown_email_fails(self):
        with pytest.raises(CommandError):
            call_command("reorder_project_sidebar", "--email", "nobody@plane.so", stdout=StringIO())
