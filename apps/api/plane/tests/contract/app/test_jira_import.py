# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import datetime, timezone
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import (
    FileAsset,
    Issue,
    IssueAssignee,
    IssueComment,
    IssueSequence,
    IssueType,
    Project,
    ProjectIssueType,
    State,
    User,
    WorkspaceMember,
)
from plane.importers.jira.backup import JiraBackup
from plane.importers.jira.loader import JiraLoader

PROJECT = {"id": "10001", "key": "DEMO", "name": "Demo Delivery"}

ADA = "account-ada"
GHOST = "account-ghost"


def document(*content):
    return {"type": "doc", "version": 1, "content": list(content)}


def paragraph(text):
    return {"type": "paragraph", "content": [{"type": "text", "text": text}]}


def issue(key, status, category, **fields):
    return {
        "key": key,
        "fields": {
            "summary": f"Work item {key}",
            "status": {"name": status, "statusCategory": {"key": category}},
            "issuetype": {"name": "Task"},
            "priority": {"name": "Medium"},
            "creator": {"accountId": ADA},
            "reporter": {"accountId": ADA},
            "created": "2024-02-09T10:00:00.000+0000",
            "updated": "2024-03-01T12:30:00.000+0000",
            **fields,
        },
    }


ISSUES = [
    issue(
        "DEMO-6",
        "In Progress",
        "indeterminate",
        summary="Rotate the signing keys",
        issuetype={"name": "Bug"},
        priority={"name": "Highest"},
        assignee={"accountId": ADA},
        description=document(
            paragraph("Keys expire soon."),
            {"type": "mediaSingle", "content": [{"type": "media", "attrs": {"alt": "diagram.png", "id": "m1"}}]},
        ),
        comment={
            "comments": [
                {
                    "id": "9001",
                    "author": {"accountId": ADA},
                    "body": document(paragraph("Rotation scheduled.")),
                    "created": "2024-02-20T09:00:00.000+0000",
                }
            ]
        },
        attachment=[{"filename": "diagram.png"}],
    ),
    issue("DEMO-7", "Backlog", "undefined", issuetype={"name": "Epic"}, priority={"name": "Lowest"}),
    issue("DEMO-8", "To Do", "new", creator={"accountId": GHOST}, reporter={"accountId": GHOST}),
    issue(
        "DEMO-9",
        "Done",
        "done",
        resolution={"name": "Fixed"},
        resolutiondate="2024-04-02T08:00:00.000+0000",
        duedate="2024-04-01",
    ),
    issue("DEMO-10", "Done", "done", resolution={"name": "Won't Do"}),
    issue("DEMO-11", "To Do", "new", attachment=[{"filename": "never-backed-up.png"}]),
]

USERS = [{"accountId": ADA, "displayName": "Ada Sample"}]


class FakeStorage:
    """Records uploads instead of talking to S3."""

    def __init__(self):
        self.uploaded = {}

    def upload_file(self, file_obj, object_name, content_type=None):
        self.uploaded[object_name] = content_type
        return True


@pytest.fixture(autouse=True)
def storage(monkeypatch):
    """Patched in rather than injected so the management command, which builds
    its own loader, never reaches S3 either."""
    fake = FakeStorage()
    monkeypatch.setattr("plane.importers.jira.assets.S3Storage", lambda *args, **kwargs: fake)
    return fake


@pytest.fixture
def backup_dir(tmp_path):
    project_dir = tmp_path / "jira" / "DEMO"
    project_dir.mkdir(parents=True)
    (project_dir / "project.json").write_text(json.dumps(PROJECT))
    (project_dir / "issues.jsonl").write_text("\n".join(json.dumps(record) for record in ISSUES))
    (tmp_path / "user_mapping.json").write_text(json.dumps(USERS))

    attachment_dir = project_dir / "attachments" / "DEMO-6"
    attachment_dir.mkdir(parents=True)
    (attachment_dir / "diagram.png").write_bytes(b"\x89PNG\r\n\x1a\n")

    return tmp_path


@pytest.fixture
def ada(db, workspace):
    user = User.objects.create(
        email="ada@example.test",
        username="ada",
        first_name="Ada",
        last_name="Sample",
        display_name="Ada Sample",
    )
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


@pytest.fixture
def loader(workspace, create_user, backup_dir):
    return JiraLoader(workspace.slug, create_user, JiraBackup(backup_dir, "DEMO"))


@pytest.mark.contract
@pytest.mark.django_db
class TestJiraImport:
    def test_creates_a_project_keyed_on_the_jira_key(self, loader, ada):
        summary = loader.run()

        project = Project.objects.get(id=summary.project_id)
        assert project.identifier == "DEMO"
        assert project.name == "Demo Delivery"
        assert project.network == 0
        assert project.issue_view is True
        assert project.external_source == "jira"

    def test_the_jira_issue_number_becomes_the_sequence_id(self, loader, ada):
        """A later import resolves Confluence references by key alone, with no
        mapping table, so DEMO-6 has to stay DEMO-6."""
        loader.run()

        record = Issue.objects.get(external_id="DEMO-6")
        assert record.sequence_id == 6
        assert record.project.identifier == "DEMO"
        assert sorted(Issue.objects.values_list("sequence_id", flat=True)) == [6, 7, 8, 9, 10, 11]

    def test_the_sequence_table_follows_the_jira_numbering(self, loader, ada):
        """The next issue a user files reads the largest sequence, so leaving
        the table on Plane's own numbering would hand out a taken number."""
        loader.run()

        record = Issue.objects.get(external_id="DEMO-11")
        assert IssueSequence.objects.get(issue=record).sequence == 11

    def test_imports_every_issue_with_its_fields(self, loader, ada):
        summary = loader.run()

        assert summary.created == 6
        record = Issue.objects.get(external_id="DEMO-6")
        assert record.name == "Rotate the signing keys"
        assert record.priority == "urgent"
        assert record.type.name == "Bug"
        assert record.state.name == "In Progress"

    def test_preserves_the_original_timestamps(self, loader, ada):
        loader.run()

        record = Issue.objects.get(external_id="DEMO-6")
        assert record.created_at == datetime(2024, 2, 9, 10, 0, tzinfo=timezone.utc)
        assert record.updated_at == datetime(2024, 3, 1, 12, 30, tzinfo=timezone.utc)

    def test_resolution_and_due_dates_survive_the_state_stamp(self, loader, ada):
        """Issue.save() stamps completed_at from the state group, so the real
        resolution date has to be written back over it."""
        loader.run()

        record = Issue.objects.get(external_id="DEMO-9")
        assert record.completed_at == datetime(2024, 4, 2, 8, 0, tzinfo=timezone.utc)
        assert record.target_date.isoformat() == "2024-04-01"

    def test_preserves_the_original_author(self, loader, ada, create_user):
        summary = loader.run()

        assert Issue.objects.get(external_id="DEMO-6").created_by_id == ada.id
        assert summary.attributed == 5

    def test_an_unmapped_account_falls_back_to_the_actor_and_is_counted(self, loader, ada, create_user):
        summary = loader.run()

        assert Issue.objects.get(external_id="DEMO-8").created_by_id == create_user.id
        assert summary.actor_fallbacks == 1
        assert summary.unmapped_accounts == {GHOST}

    def test_the_assignee_is_linked(self, loader, ada):
        loader.run()

        record = Issue.objects.get(external_id="DEMO-6")
        assert list(IssueAssignee.objects.filter(issue=record).values_list("assignee_id", flat=True)) == [ada.id]
        assert IssueAssignee.objects.count() == 1

    def test_states_cover_every_status_category(self, loader, ada):
        summary = loader.run()

        groups = dict(State.objects.filter(project_id=summary.project_id).values_list("name", "group"))
        assert groups["Backlog"] == "backlog"
        assert groups["To Do"] == "unstarted"
        assert groups["In Progress"] == "started"
        assert groups["Done"] == "completed"
        assert groups["Cancelled"] == "cancelled"

    def test_a_cancelling_resolution_separates_cancelled_from_completed(self, loader, ada):
        loader.run()

        assert Issue.objects.get(external_id="DEMO-9").state.group == "completed"
        assert Issue.objects.get(external_id="DEMO-10").state.group == "cancelled"

    def test_issue_types_are_created_and_epics_marked(self, loader, ada):
        summary = loader.run()

        types = {issue_type.name: issue_type for issue_type in IssueType.objects.all()}
        assert {"Bug", "Epic", "Task"} <= set(types)
        assert types["Epic"].is_epic is True
        assert types["Bug"].is_epic is False
        assert ProjectIssueType.objects.filter(project_id=summary.project_id).count() == len(types)

    def test_comments_carry_their_author_and_date(self, loader, ada):
        summary = loader.run()

        comment = IssueComment.objects.get(external_id="9001")
        assert summary.comments == 1
        assert comment.actor_id == ada.id
        assert "Rotation scheduled." in comment.comment_html
        assert comment.created_at == datetime(2024, 2, 20, 9, 0, tzinfo=timezone.utc)

    def test_descriptions_are_converted_and_sanitised(self, loader, ada):
        loader.run()

        body = Issue.objects.get(external_id="DEMO-6").description_html
        assert "<p>Keys expire soon.</p>" in body
        assert "script" not in body

    def test_attachments_are_uploaded_and_resolve_in_the_body(self, loader, ada, storage):
        summary = loader.run()

        record = Issue.objects.get(external_id="DEMO-6")
        asset = FileAsset.objects.get(issue=record)
        assert asset.entity_type == FileAsset.EntityTypeContext.ISSUE_ATTACHMENT
        assert summary.attachments == 1
        assert len(storage.uploaded) == 1
        assert f'src="{asset.id}"' in record.description_html

    def test_a_missing_attachment_file_is_counted_and_the_run_completes(self, loader, ada):
        """The on-disk layout is inferred, so a reference with no file behind it
        can never stop the import."""
        summary = loader.run()

        assert summary.missing_attachments == {"DEMO-11/never-backed-up.png"}
        assert Issue.objects.count() == 6
        assert FileAsset.objects.count() == 1

    def test_every_attachment_path_being_wrong_still_imports(
        self, workspace, create_user, backup_dir, ada, monkeypatch
    ):
        monkeypatch.setattr(
            "plane.importers.jira.assets.attachment_source_path",
            lambda backup, issue_key, filename: backup.project_dir / "nowhere" / filename,
        )

        summary = JiraLoader(workspace.slug, create_user, JiraBackup(backup_dir, "DEMO")).run()

        assert summary.created == 6
        assert summary.attachments == 0
        assert len(summary.missing_attachments) == 2

    def test_rerun_changes_nothing(self, loader, ada, storage):
        first = loader.run()
        storage.uploaded.clear()

        second = loader.run()

        assert (second.created, second.updated) == (0, 6)
        assert second.project_id == first.project_id
        assert Issue.objects.count() == 6
        assert IssueComment.objects.count() == 1
        assert IssueAssignee.objects.count() == 1
        assert FileAsset.objects.count() == 1
        assert Project.objects.count() == 1
        assert storage.uploaded == {}
        assert Issue.objects.get(external_id="DEMO-6").sequence_id == 6
        assert second.states == 0
        assert State.objects.filter(project_id=first.project_id).count() == first.states

    def test_dry_run_writes_nothing(self, loader, ada, storage):
        summary = loader.run(dry_run=True)

        assert summary.created == 6
        assert Issue.objects.count() == 0
        assert Project.objects.count() == 0
        assert State.objects.count() == 0
        assert IssueType.objects.count() == 0
        assert summary.attachments_skipped is True
        assert storage.uploaded == {}


@pytest.mark.contract
@pytest.mark.django_db
class TestCollidingKey:
    """Five Jira keys match a Confluence space already imported. The key is
    preserved on both sides, so one project has to hold the wiki and the work
    items rather than the pair being split."""

    @pytest.fixture
    def wiki(self, workspace, create_user):
        return Project.objects.create(
            workspace=workspace,
            name="Wiki Demo",
            identifier="DEMO",
            network=2,
            issue_view=False,
            external_source="confluence",
            external_id="20742223",
        )

    def test_the_existing_project_gains_the_work_items(self, loader, ada, wiki):
        summary = loader.run()

        assert summary.merged is True
        assert summary.project_id == str(wiki.id)
        assert Project.objects.filter(identifier="DEMO").count() == 1
        assert Issue.objects.filter(project=wiki).count() == 6

    def test_the_existing_project_keeps_its_own_settings(self, loader, ada, wiki):
        loader.run()

        wiki.refresh_from_db()
        assert wiki.name == "Wiki Demo"
        assert wiki.network == 2
        assert wiki.external_source == "confluence"
        assert wiki.issue_view is True


@pytest.mark.contract
@pytest.mark.django_db
class TestImportCommand:
    def run(self, directory, target_workspace, target_actor, **overrides):
        output = StringIO()
        options = {
            "project": "DEMO",
            "backup_dir": str(directory),
            "workspace": target_workspace.slug,
            "actor": target_actor.email,
            **overrides,
        }
        call_command("import_jira", stdout=output, **options)
        return output.getvalue()

    def test_imports_and_reports(self, backup_dir, workspace, create_user, ada):
        output = self.run(backup_dir, workspace, create_user)

        assert Issue.objects.count() == 6
        assert "6 created, 0 updated" in output
        assert "attributed  5/6" in output
        assert "missing     1 attachments" in output

    def test_dry_run_is_reported_and_rolled_back(self, backup_dir, workspace, create_user, ada):
        output = self.run(backup_dir, workspace, create_user, dry_run=True)

        assert "dry run, rolled back" in output
        assert Issue.objects.count() == 0

    @pytest.mark.parametrize(
        "overrides",
        [{"project": "NOPE"}, {"workspace": "no-such-workspace"}, {"actor": "nobody@plane.so"}],
    )
    def test_bad_arguments_fail_loudly(self, backup_dir, workspace, create_user, overrides):
        with pytest.raises(CommandError):
            self.run(backup_dir, workspace, create_user, **overrides)
