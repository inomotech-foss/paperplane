# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import datetime, timezone

import pytest

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueActivity,
    IssueLabel,
    IssueRelation,
    IssueSubscriber,
    IssueVote,
    Label,
    Module,
    ModuleIssue,
    User,
    WorkspaceMember,
)
from plane.importers.jira.backup import JiraBackup
from plane.importers.jira.loader import JiraLoader

PROJECT = {"id": "10001", "key": "DEMO", "name": "Demo Delivery"}

ADA = "account-ada"
GHOST = "account-ghost"

EPIC_LINK = "customfield_10014"
RANK = "customfield_10019"
SPRINT = "customfield_10020"
STORY_POINTS = "customfield_10016"

CLOSED_SPRINT = {
    "id": 1,
    "name": "Sprint one",
    "state": "closed",
    "boardId": 7,
    "goal": "Ship the first slice",
    "startDate": "2024-01-08T09:00:00.000Z",
    "endDate": "2024-01-22T09:00:00.000Z",
    "completeDate": "2024-01-23T11:00:00.000Z",
}
ACTIVE_SPRINT = {
    "id": 2,
    "name": "Sprint two",
    "state": "active",
    "boardId": 7,
    "startDate": "2024-01-23T09:00:00.000Z",
    "endDate": "2024-02-06T09:00:00.000Z",
}
FUTURE_SPRINT = {"id": 3, "name": "Sprint three", "state": "future", "boardId": 8}

BLOCKS = {"name": "Blocks", "inward": "is blocked by", "outward": "blocks"}
CLONERS = {"name": "Cloners", "inward": "is cloned by", "outward": "clones"}


def issue(key, rank, changelog=None, **fields):
    """Jira writes the changelog beside `fields`, not inside it."""
    return {
        "key": key,
        "changelog": {"histories": list(changelog or [])},
        "fields": {
            "summary": f"Work item {key}",
            "status": {"name": "To Do", "statusCategory": {"key": "new"}},
            "issuetype": {"name": "Task"},
            "priority": {"name": "Medium"},
            "creator": {"accountId": ADA},
            "reporter": {"accountId": ADA},
            "created": "2024-01-02T10:00:00.000+0000",
            "updated": "2024-01-03T10:00:00.000+0000",
            RANK: rank,
            **fields,
        },
    }


def history(entry_id, account_id, created, items):
    return {"id": entry_id, "author": {"accountId": account_id}, "created": created, "items": items}


# The file order is deliberate: every issue that points at another one comes
# first, so a single-pass loader would drop the link.
ISSUES = [
    issue(
        "DEMO-1",
        "0|i0000f:",
        parent={"key": "DEMO-4"},
        issuelinks=[{"id": "2", "type": BLOCKS, "inwardIssue": {"key": "DEMO-3"}}],
    ),
    issue("DEMO-2", "0|i00007:", **{EPIC_LINK: "DEMO-5"}),
    issue(
        "DEMO-3",
        "0|i0000z:",
        issuelinks=[
            {"id": "1", "type": CLONERS, "outwardIssue": {"key": "DEMO-4"}},
            {"id": "2", "type": BLOCKS, "outwardIssue": {"key": "DEMO-1"}},
        ],
        changelog=[
            history(
                "501",
                GHOST,
                "2024-01-04T14:00:00.000+0000",
                [{"field": "priority", "fromString": "Low", "toString": "High"}],
            )
        ],
    ),
    issue(
        "DEMO-4",
        "0|i0001n:",
        subtasks=[{"key": "DEMO-3"}],
        issuelinks=[{"id": "1", "type": CLONERS, "inwardIssue": {"key": "DEMO-3"}}],
        **{SPRINT: [CLOSED_SPRINT]},
    ),
    issue("DEMO-5", "0|i0002f:", issuetype={"name": "Epic"}, parent={"key": "DEMO-99"}, **{SPRINT: [FUTURE_SPRINT]}),
    issue(
        "DEMO-6",
        "0|i0003v:",
        labels=["backend", "urgent"],
        components=[{"name": "api"}],
        fixVersions=[{"name": "Release 1.0"}],
        watches={"watchCount": 1, "watchers": [{"accountId": ADA}]},
        votes={"votes": 1, "voters": [{"accountId": ADA}]},
        worklog={"total": 2, "worklogs": [{"id": "1", "timeSpentSeconds": 3600}, {"id": "2", "timeSpentSeconds": 900}]},
        changelog=[
            history(
                "601",
                ADA,
                "2024-01-05T08:15:00.000+0000",
                [
                    {"field": "status", "fromString": "To Do", "toString": "In Progress"},
                    {"field": "summary", "fromString": "Old title", "toString": "Work item DEMO-6"},
                ],
            )
        ],
        **{SPRINT: [CLOSED_SPRINT, ACTIVE_SPRINT], STORY_POINTS: 5, "customfield_10050": "app noise"},
    ),
]

USERS = [{"accountId": ADA, "displayName": "Ada Sample"}]


class FakeStorage:
    def __init__(self):
        self.uploaded = {}

    def upload_file(self, file_obj, object_name, content_type=None):
        self.uploaded[object_name] = content_type
        return True


@pytest.fixture(autouse=True)
def storage(monkeypatch):
    fake = FakeStorage()
    monkeypatch.setattr("plane.importers.jira.assets.S3Storage", lambda *args, **kwargs: fake)
    return fake


@pytest.fixture
def backup_dir(tmp_path):
    """No `sprints.json`. The board endpoints failed during the real backup, so
    the loader has to reconstruct the sprints from the issues alone."""
    project_dir = tmp_path / "jira" / "DEMO"
    project_dir.mkdir(parents=True)
    (project_dir / "project.json").write_text(json.dumps(PROJECT))
    (project_dir / "issues.jsonl").write_text("\n".join(json.dumps(record) for record in ISSUES))
    (tmp_path / "user_mapping.json").write_text(json.dumps(USERS))
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


def by_key(key):
    return Issue.objects.get(external_id=key)


@pytest.mark.contract
@pytest.mark.django_db
class TestParents:
    def test_a_child_read_before_its_parent_is_still_parented(self, loader, ada):
        """DEMO-1 names DEMO-4, which is three lines further down the file."""
        summary = loader.run()

        assert by_key("DEMO-1").parent_id == by_key("DEMO-4").id
        assert summary.parents == 3

    def test_an_epic_link_becomes_a_parent(self, loader, ada):
        """The Epic Link lives in a custom field, not in `parent`."""
        loader.run()

        assert by_key("DEMO-2").parent_id == by_key("DEMO-5").id

    def test_a_subtask_listing_parents_the_child(self, loader, ada):
        loader.run()

        assert by_key("DEMO-3").parent_id == by_key("DEMO-4").id

    def test_a_parent_outside_the_backup_is_counted_not_fatal(self, loader, ada):
        summary = loader.run()

        assert by_key("DEMO-5").parent_id is None
        assert summary.unresolved_parents == {"DEMO-99"}


@pytest.mark.contract
@pytest.mark.django_db
class TestRelations:
    def test_a_blocking_link_lands_on_the_blocked_issue(self, loader, ada):
        """Plane has no `blocking`, only `blocked_by`, so "DEMO-3 blocks DEMO-1"
        has to be stored the other way round."""
        loader.run()

        relation = IssueRelation.objects.get(relation_type="blocked_by")
        assert relation.issue_id == by_key("DEMO-1").id
        assert relation.related_issue_id == by_key("DEMO-3").id

    def test_a_link_type_plane_cannot_name_is_downgraded_not_dropped(self, loader, ada):
        summary = loader.run()

        relation = IssueRelation.objects.get(relation_type="relates_to")
        assert {relation.issue.external_id, relation.related_issue.external_id} == {"DEMO-3", "DEMO-4"}
        assert summary.downgraded_relations == 1

    def test_a_link_written_on_both_issues_becomes_one_row(self, loader, ada):
        summary = loader.run()

        assert IssueRelation.objects.count() == 2
        assert summary.relations == 2


@pytest.mark.contract
@pytest.mark.django_db
class TestSprints:
    def test_the_backup_has_no_sprint_file(self, backup_dir):
        assert not (backup_dir / "jira" / "DEMO" / "sprints.json").exists()

    def test_every_sprint_state_becomes_a_cycle(self, loader, ada):
        summary = loader.run()

        cycles = {cycle.name: cycle for cycle in Cycle.objects.all()}
        assert set(cycles) == {"Sprint one", "Sprint two", "Sprint three"}
        assert summary.cycles == 3

    def test_a_closed_sprint_keeps_its_dates(self, loader, ada):
        loader.run()

        cycle = Cycle.objects.get(name="Sprint one")
        assert cycle.start_date == datetime(2024, 1, 8, 9, 0, tzinfo=timezone.utc)
        assert cycle.end_date == datetime(2024, 1, 23, 11, 0, tzinfo=timezone.utc)
        assert cycle.description == "Ship the first slice"

    def test_a_future_sprint_carries_no_dates(self, loader, ada):
        loader.run()

        cycle = Cycle.objects.get(name="Sprint three")
        assert cycle.start_date is None
        assert cycle.end_date is None

    def test_an_issue_joins_the_last_sprint_it_was_in(self, loader, ada):
        """Plane puts an issue in one cycle; Jira lists every sprint it passed
        through, and the last one is where it landed."""
        loader.run()

        cycles = CycleIssue.objects.filter(issue=by_key("DEMO-6"))
        assert [row.cycle.name for row in cycles] == ["Sprint two"]
        assert CycleIssue.objects.count() == 3


@pytest.mark.contract
@pytest.mark.django_db
class TestLabelsAndModules:
    def test_labels_and_components_collapse_onto_labels(self, loader, ada):
        summary = loader.run()

        assert set(Label.objects.values_list("name", flat=True)) == {"backend", "urgent", "api"}
        assert IssueLabel.objects.filter(issue=by_key("DEMO-6")).count() == 3
        assert summary.labels == 3

    def test_a_fix_version_becomes_a_module(self, loader, ada):
        summary = loader.run()

        module = Module.objects.get(name="Release 1.0")
        assert list(ModuleIssue.objects.values_list("issue__external_id", flat=True)) == ["DEMO-6"]
        assert module.external_source == "jira"
        assert summary.modules == 1


@pytest.mark.contract
@pytest.mark.django_db
class TestRank:
    def test_lexorank_order_survives_into_sort_order(self, loader, ada):
        """The ranks deliberately disagree with the file order, which is the
        only thing a naive import would preserve."""
        loader.run()

        ordered = list(Issue.objects.order_by("sort_order").values_list("external_id", flat=True))
        assert ordered == ["DEMO-2", "DEMO-1", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-6"]


@pytest.mark.contract
@pytest.mark.django_db
class TestChangelog:
    def test_entries_keep_their_actor_and_timestamp(self, loader, ada, create_user):
        summary = loader.run()

        activity = IssueActivity.objects.get(field="state")
        assert activity.actor_id == ada.id
        assert activity.actor_id != create_user.id
        assert activity.created_at == datetime(2024, 1, 5, 8, 15, tzinfo=timezone.utc)
        assert (activity.old_value, activity.new_value) == ("To Do", "In Progress")
        assert summary.activities == 3

    def test_one_history_becomes_one_entry_per_changed_field(self, loader, ada):
        loader.run()

        fields = set(IssueActivity.objects.filter(issue=by_key("DEMO-6")).values_list("field", flat=True))
        assert fields == {"state", "name"}

    def test_an_unmapped_author_falls_back_to_the_actor(self, loader, ada, create_user):
        summary = loader.run()

        assert IssueActivity.objects.get(field="priority").actor_id == create_user.id
        assert GHOST in summary.unmapped_accounts


@pytest.mark.contract
@pytest.mark.django_db
class TestInterestAndDrops:
    def test_watchers_and_voters_are_kept(self, loader, ada):
        summary = loader.run()

        assert IssueSubscriber.objects.get(issue=by_key("DEMO-6")).subscriber_id == ada.id
        assert IssueVote.objects.get(issue=by_key("DEMO-6")).vote == 1
        assert (summary.subscribers, summary.votes) == (1, 1)

    def test_worklogs_are_counted_and_not_modelled(self, loader, ada):
        """No community model holds time tracking, so the count is the only
        honest record that something was left behind."""
        summary = loader.run()

        assert summary.worklogs == 2

    def test_unmodelled_custom_fields_are_counted(self, loader, ada):
        """Story points sit on only a handful of issues, so they are chrome too
        rather than an estimate pass of their own."""
        summary = loader.run()

        assert summary.chrome == {STORY_POINTS, "customfield_10050"}


@pytest.mark.contract
@pytest.mark.django_db
class TestRerun:
    def test_a_second_run_duplicates_nothing(self, loader, ada):
        loader.run()
        second = loader.run()

        assert Label.objects.count() == 3
        assert IssueLabel.objects.count() == 3
        assert Module.objects.count() == 1
        assert ModuleIssue.objects.count() == 1
        assert Cycle.objects.count() == 3
        assert CycleIssue.objects.count() == 3
        assert IssueRelation.objects.count() == 2
        assert IssueActivity.objects.count() == 3
        assert IssueSubscriber.objects.count() == 1
        assert IssueVote.objects.count() == 1
        assert (second.labels, second.modules, second.cycles) == (0, 0, 0)
        assert (second.relations, second.activities, second.parents) == (0, 0, 0)

    def test_a_second_run_keeps_the_backlog_order(self, loader, ada):
        loader.run()
        loader.run()

        ordered = list(Issue.objects.order_by("sort_order").values_list("external_id", flat=True))
        assert ordered == ["DEMO-2", "DEMO-1", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-6"]
