# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User

GLOBAL_SPACE_A = {"id": "111", "key": "DEMO", "name": "Demo Space", "type": "global", "status": "current"}
# A space with no "type" key at all is treated as global, same as report_confluence.
GLOBAL_SPACE_B = {"id": "222", "key": "WIKI", "name": "Wiki Space", "status": "archived"}
PERSONAL_SPACE = {
    "id": "333",
    "key": "PSNL1",
    "name": "A Personal Space",
    "type": "personal",
    "status": "current",
    "spaceOwnerId": "acc-owner",
}
OWNER = {"accountId": "acc-owner", "displayName": "Space Owner", "emailAddress": "owner@plane.so"}


def _write_space(backup_dir, space):
    space_dir = backup_dir / "confluence" / space["key"]
    space_dir.mkdir(parents=True)
    (space_dir / "space.json").write_text(json.dumps(space))


@pytest.fixture
def backup_dir(tmp_path):
    _write_space(tmp_path, GLOBAL_SPACE_A)
    _write_space(tmp_path, GLOBAL_SPACE_B)
    _write_space(tmp_path, PERSONAL_SPACE)
    (tmp_path / "user_mapping.json").write_text(json.dumps([OWNER]))
    return tmp_path


@pytest.fixture
def owner():
    return User.objects.create(username="space-owner", email=OWNER["emailAddress"], display_name="Space Owner")


@pytest.fixture
def demo_project(workspace):
    return Project.objects.create(
        name="Demo Project",
        identifier="DEMO",
        workspace=workspace,
        external_source="confluence",
        external_id=GLOBAL_SPACE_A["id"],
        network=2,
        issue_view=True,
    )


@pytest.fixture
def wiki_project(workspace):
    return Project.objects.create(
        name="Wiki Project",
        identifier="WIKI",
        workspace=workspace,
        external_source="confluence",
        external_id=GLOBAL_SPACE_B["id"],
        network=2,
        issue_view=True,
    )


@pytest.fixture
def personal_project(workspace):
    return Project.objects.create(
        name="Personal Project",
        identifier="PSNL1",
        workspace=workspace,
        external_source="confluence",
        external_id=PERSONAL_SPACE["id"],
        network=2,
        issue_view=True,
    )


@pytest.fixture
def other_source_project(workspace):
    """A project imported from something other than Confluence: no pass may touch it."""
    return Project.objects.create(
        name="Other Project",
        identifier="OTHR",
        workspace=workspace,
        external_source="jira",
        external_id="999",
        network=2,
        issue_view=True,
    )


@pytest.fixture
def project_page(workspace, create_user, personal_project):
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Synthetic Page")
    return ProjectPage.objects.create(workspace=workspace, project=personal_project, page=page)


def run(**options):
    output = StringIO()
    call_command("prune_confluence_imports", stdout=output, **options)
    return output.getvalue()


def snapshot(*projects):
    """A comparable snapshot of the fields every pass might change."""
    return [
        (p.pk, p.deleted_at, p.network, p.issue_view, p.page_view, p.archived_at)
        for p in (Project.all_objects.get(pk=p.pk) for p in projects)
    ]


@pytest.mark.unit
@pytest.mark.django_db
class TestPrunePersonal:
    def test_soft_deletes_matching_projects_and_their_pages(
        self, workspace, backup_dir, personal_project, demo_project, project_page
    ):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, prune_personal=True)

        assert not Project.objects.filter(pk=personal_project.pk).exists()
        assert Project.all_objects.get(pk=personal_project.pk).deleted_at is not None
        assert not ProjectPage.objects.filter(pk=project_page.pk).exists()

        # A project from a non-personal space is left alone.
        assert Project.objects.filter(pk=demo_project.pk).exists()

    def test_is_idempotent(self, workspace, backup_dir, personal_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, prune_personal=True)
        first_deleted_at = Project.all_objects.get(pk=personal_project.pk).deleted_at

        output = run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, prune_personal=True)

        assert "0 project(s)" in output
        assert Project.all_objects.get(pk=personal_project.pk).deleted_at == first_deleted_at

    def test_dry_run_is_the_default_and_writes_nothing(self, workspace, backup_dir, personal_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, prune_personal=True)

        project = Project.all_objects.get(pk=personal_project.pk)
        assert project.deleted_at is None


@pytest.mark.unit
@pytest.mark.django_db
class TestMakeSecret:
    def test_sets_network_zero_on_confluence_projects_only(
        self, workspace, backup_dir, demo_project, other_source_project
    ):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, make_secret=True)

        assert Project.objects.get(pk=demo_project.pk).network == 0
        assert Project.objects.get(pk=other_source_project.pk).network == 2

    def test_is_idempotent(self, workspace, backup_dir, demo_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, make_secret=True)
        output = run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, make_secret=True)

        assert "0 project(s)" in output
        assert Project.objects.get(pk=demo_project.pk).network == 0

    def test_dry_run_is_the_default_and_writes_nothing(self, workspace, backup_dir, demo_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, make_secret=True)

        assert Project.objects.get(pk=demo_project.pk).network == 2


@pytest.mark.unit
@pytest.mark.django_db
class TestDisableWorkItems:
    def test_sets_issue_view_false_on_confluence_projects_only(
        self, workspace, backup_dir, demo_project, other_source_project
    ):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, disable_work_items=True)

        assert Project.objects.get(pk=demo_project.pk).issue_view is False
        assert Project.objects.get(pk=other_source_project.pk).issue_view is True

    def test_is_idempotent(self, workspace, backup_dir, demo_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, disable_work_items=True)
        output = run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, disable_work_items=True)

        assert "0 project(s)" in output
        assert Project.objects.get(pk=demo_project.pk).issue_view is False

    def test_dry_run_is_the_default_and_writes_nothing(self, workspace, backup_dir, demo_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, disable_work_items=True)

        assert Project.objects.get(pk=demo_project.pk).issue_view is True


@pytest.mark.unit
@pytest.mark.django_db
class TestScope:
    def test_spaces_limits_a_pass(self, workspace, backup_dir, demo_project, wiki_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, make_secret=True, spaces="DEMO")

        assert Project.objects.get(pk=demo_project.pk).network == 0
        assert Project.objects.get(pk=wiki_project.pk).network == 2

    def test_personal_limits_a_pass(self, workspace, backup_dir, demo_project, personal_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, make_secret=True, personal=True)

        assert Project.objects.get(pk=personal_project.pk).network == 0
        assert Project.objects.get(pk=demo_project.pk).network == 2

    def test_unknown_space_key_raises(self, workspace, backup_dir):
        with pytest.raises(CommandError):
            run(backup_dir=str(backup_dir), workspace=workspace.slug, make_secret=True, spaces="NOPE")


@pytest.mark.unit
@pytest.mark.django_db
class TestArchiveStale:
    def test_archives_projects_whose_space_is_archived(self, workspace, backup_dir, demo_project, wiki_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, archive_stale=True)

        assert Project.objects.get(pk=wiki_project.pk).archived_at is not None
        assert Project.objects.get(pk=demo_project.pk).archived_at is None

    def test_is_idempotent(self, workspace, backup_dir, wiki_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, archive_stale=True)
        first = Project.objects.get(pk=wiki_project.pk).archived_at

        output = run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, archive_stale=True)

        assert "0 project(s)" in output
        assert Project.objects.get(pk=wiki_project.pk).archived_at == first


@pytest.mark.unit
@pytest.mark.django_db
class TestArchive:
    def test_archives_only_the_named_projects(self, workspace, backup_dir, demo_project, wiki_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, archive=True, spaces="DEMO")

        assert Project.objects.get(pk=demo_project.pk).archived_at is not None
        assert Project.objects.get(pk=wiki_project.pk).archived_at is None

    def test_needs_spaces(self, workspace, backup_dir, demo_project):
        with pytest.raises(CommandError):
            run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, archive=True)


@pytest.mark.unit
@pytest.mark.django_db
class TestAssignOwners:
    def test_owner_becomes_admin(self, workspace, backup_dir, personal_project, owner):
        output = run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, assign_owners=True)

        assert ProjectMember.objects.get(project=personal_project, member=owner).role == 20
        assert "PSNL1 -> owner@plane.so" in output

    def test_owner_without_an_account_is_reported(self, workspace, backup_dir, personal_project):
        output = run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, assign_owners=True)

        assert "no active user for the owner of: PSNL1" in output
        assert not ProjectMember.objects.filter(project=personal_project).exists()

    def test_owner_on_another_domain(self, workspace, backup_dir, personal_project):
        user = User.objects.create(username="moved-owner", email="owner@new.example")

        run(
            backup_dir=str(backup_dir),
            workspace=workspace.slug,
            no_dry_run=True,
            assign_owners=True,
            email_domain=["plane.so=new.example"],
        )

        assert ProjectMember.objects.get(project=personal_project, member=user).role == 20

    def test_is_idempotent(self, workspace, backup_dir, personal_project, owner):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, assign_owners=True)
        output = run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, assign_owners=True)

        assert "0 project(s)" in output
        assert ProjectMember.objects.filter(project=personal_project, member=owner).count() == 1


@pytest.mark.unit
@pytest.mark.django_db
class TestDisablePages:
    def test_hides_pages_on_the_named_projects_of_any_source(self, workspace, backup_dir, other_source_project):
        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, disable_pages=True, spaces="OTHR")

        assert Project.objects.get(pk=other_source_project.pk).page_view is False

    def test_needs_spaces(self, workspace, backup_dir):
        with pytest.raises(CommandError):
            run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True, disable_pages=True)


@pytest.mark.unit
@pytest.mark.django_db
class TestSafety:
    def test_no_pass_flag_is_a_safe_noop(self, workspace, backup_dir, demo_project, wiki_project, personal_project):
        before = snapshot(demo_project, wiki_project, personal_project)

        run(backup_dir=str(backup_dir), workspace=workspace.slug, no_dry_run=True)

        after = snapshot(demo_project, wiki_project, personal_project)
        assert before == after

    def test_dry_run_default_touches_nothing_even_with_every_pass(
        self, workspace, backup_dir, demo_project, wiki_project, personal_project
    ):
        before = snapshot(demo_project, wiki_project, personal_project)

        run(
            backup_dir=str(backup_dir),
            workspace=workspace.slug,
            prune_personal=True,
            make_secret=True,
            disable_work_items=True,
            archive_stale=True,
            assign_owners=True,
        )

        after = snapshot(demo_project, wiki_project, personal_project)
        assert before == after

    def test_non_confluence_project_is_never_touched(self, workspace, backup_dir, other_source_project):
        before = snapshot(other_source_project)

        run(
            backup_dir=str(backup_dir),
            workspace=workspace.slug,
            no_dry_run=True,
            prune_personal=True,
            make_secret=True,
            disable_work_items=True,
            archive_stale=True,
            assign_owners=True,
        )

        after = snapshot(other_source_project)
        assert before == after

    def test_missing_workspace_raises(self, backup_dir):
        with pytest.raises(CommandError):
            run(backup_dir=str(backup_dir), workspace="does-not-exist", make_secret=True)
