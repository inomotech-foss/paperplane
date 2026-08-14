# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import Page, Project, ProjectPage

GLOBAL_SPACE_A = {"id": "111", "key": "DEMO", "name": "Demo Space", "type": "global"}
# A space with no "type" key at all is treated as global, same as report_confluence.
GLOBAL_SPACE_B = {"id": "222", "key": "WIKI", "name": "Wiki Space"}
PERSONAL_SPACE = {"id": "333", "key": "PSNL1", "name": "A Personal Space", "type": "personal"}


def _write_space(backup_dir, space):
    space_dir = backup_dir / "confluence" / space["key"]
    space_dir.mkdir(parents=True)
    (space_dir / "space.json").write_text(json.dumps(space))


@pytest.fixture
def backup_dir(tmp_path):
    _write_space(tmp_path, GLOBAL_SPACE_A)
    _write_space(tmp_path, GLOBAL_SPACE_B)
    _write_space(tmp_path, PERSONAL_SPACE)
    return tmp_path


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
    return [(p.pk, p.deleted_at, p.network, p.issue_view) for p in (Project.all_objects.get(pk=p.pk) for p in projects)]


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
        )

        after = snapshot(other_source_project)
        assert before == after

    def test_missing_workspace_raises(self, backup_dir):
        with pytest.raises(CommandError):
            run(backup_dir=str(backup_dir), workspace="does-not-exist", make_secret=True)
