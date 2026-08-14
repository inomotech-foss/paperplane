# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.importers.jira.backup import JiraBackup, _issue_from_record, project_keys

# The characters str.splitlines breaks on and str.split("\n") does not. A line
# cut at one of them no longer parses as JSON.
LINE_SEPARATOR = chr(0x2028)
PARAGRAPH_SEPARATOR = chr(0x2029)


def record(key="DEMO-1", **fields):
    return {"key": key, "fields": {"summary": "Rotate the signing keys", **fields}}


def write_project(root, key, records, name="Demo", users=None):
    """Builds the slice of a backup tree the reader reads."""
    project_dir = root / "jira" / key
    project_dir.mkdir(parents=True)
    (project_dir / "project.json").write_text(json.dumps({"key": key, "name": name}))
    (project_dir / "issues.jsonl").write_text(
        "\n".join(json.dumps(item, ensure_ascii=False) for item in records), encoding="utf-8"
    )
    if users is not None:
        (root / "user_mapping.json").write_text(json.dumps(users))
    return project_dir


@pytest.mark.unit
class TestIssueRecords:
    def test_the_fields_a_loader_needs_are_read(self):
        issue = _issue_from_record(
            record(
                issuetype={"name": "Bug"},
                status={"name": "In Progress"},
                priority={"name": "High"},
                labels=["backend", ""],
                reporter={"accountId": "account-1"},
                assignee={"accountId": "account-2"},
                parent={"key": "DEMO-9"},
                created="2024-02-09T10:00:00.000+0000",
            )
        )

        assert issue.key == "DEMO-1"
        assert issue.summary == "Rotate the signing keys"
        assert (issue.issue_type, issue.status, issue.priority) == ("Bug", "In Progress", "High")
        assert issue.labels == ["backend"]
        assert (issue.reporter_id, issue.assignee_id) == ("account-1", "account-2")
        assert issue.parent_key == "DEMO-9"
        assert issue.created_at.year == 2024

    def test_a_bare_issue_still_parses(self):
        issue = _issue_from_record({"key": "DEMO-2", "fields": {}})

        assert issue.summary == "Untitled"
        assert issue.description is None
        assert issue.comments == []

    def test_comments_carry_their_author_and_body(self):
        body = {"type": "doc", "version": 1, "content": []}
        issue = _issue_from_record(
            record(comment={"comments": [{"id": "10", "author": {"accountId": "account-1"}, "body": body}]})
        )

        assert [(comment.id, comment.author_id, comment.body) for comment in issue.comments] == [
            ("10", "account-1", body)
        ]

    def test_a_plain_text_description_is_not_a_document(self):
        """ADF is the only body format in the backup, so anything else is not a
        document the converter can read."""
        assert _issue_from_record(record(description="legacy text")).description is None

    def test_attachments_are_listed_by_filename(self):
        issue = _issue_from_record(record(attachment=[{"filename": "diagram.png"}, {"id": "1"}]))

        assert issue.attachments == ["diagram.png"]


@pytest.mark.unit
class TestIssueStream:
    def test_issues_stream_in_file_order(self, tmp_path):
        write_project(tmp_path, "DEMO", [record("DEMO-1"), record("DEMO-2")])

        assert [issue.key for issue in JiraBackup(tmp_path, "DEMO").issues()] == ["DEMO-1", "DEMO-2"]

    @pytest.mark.parametrize("separator", [LINE_SEPARATOR, PARAGRAPH_SEPARATOR])
    def test_a_body_holding_a_unicode_separator_survives(self, tmp_path, separator):
        """str.splitlines would cut the line here and leave an unterminated JSON
        string, so the reader must split on newlines alone."""
        summary = f"Before{separator}after"
        write_project(tmp_path, "DEMO", [{"key": "DEMO-1", "fields": {"summary": summary}}])

        assert [issue.summary for issue in JiraBackup(tmp_path, "DEMO").issues()] == [summary]

    def test_blank_lines_are_skipped(self, tmp_path):
        project_dir = write_project(tmp_path, "DEMO", [record("DEMO-1")])
        (project_dir / "issues.jsonl").write_text(
            json.dumps(record("DEMO-1")) + "\n\n" + json.dumps(record("DEMO-2")) + "\n"
        )

        assert len(list(JiraBackup(tmp_path, "DEMO").issues())) == 2

    def test_a_project_without_issues_is_not_an_error(self, tmp_path):
        (tmp_path / "jira" / "DEMO").mkdir(parents=True)

        assert list(JiraBackup(tmp_path, "DEMO").issues()) == []


@pytest.mark.unit
class TestBackupTree:
    def test_project_keys_list_only_backed_up_projects(self, tmp_path):
        write_project(tmp_path, "WIKI", [])
        write_project(tmp_path, "DEMO", [])
        (tmp_path / "jira" / "half-copied").mkdir()

        assert project_keys(tmp_path) == ["DEMO", "WIKI"]

    def test_a_missing_backup_is_not_an_error(self, tmp_path):
        assert project_keys(tmp_path) == []

    def test_the_project_file_is_read(self, tmp_path):
        write_project(tmp_path, "DEMO", [], name="Demo Project")
        backup = JiraBackup(tmp_path, "DEMO")

        assert backup.exists()
        assert backup.project()["name"] == "Demo Project"

    def test_attachments_are_found_under_the_issue_key(self, tmp_path):
        project_dir = write_project(tmp_path, "DEMO", [])
        directory = project_dir / "attachments" / "DEMO-1"
        directory.mkdir(parents=True)
        (directory / "diagram.png").write_bytes(b"stub")
        (directory / "~working.tmp").write_bytes(b"stub")
        backup = JiraBackup(tmp_path, "DEMO")

        assert [path.name for path in backup.attachments("DEMO-1")] == ["diagram.png"]
        assert backup.attachment_path("DEMO-1", "diagram.png").read_bytes() == b"stub"

    def test_an_issue_without_attachments_is_not_an_error(self, tmp_path):
        write_project(tmp_path, "DEMO", [])

        assert JiraBackup(tmp_path, "DEMO").attachments("DEMO-1") == []

    def test_the_user_map_is_shared_across_projects(self, tmp_path):
        write_project(
            tmp_path,
            "DEMO",
            [],
            users=[{"accountId": "account-1", "displayName": "Ada Sample", "emailAddress": " ada@example.test "}],
        )
        backup = JiraBackup(tmp_path, "DEMO")

        assert backup.user_mapping() == {"account-1": "Ada Sample"}
        assert backup.users()["account-1"].email == "ada@example.test"

    def test_a_backup_without_a_user_map_has_no_users(self, tmp_path):
        write_project(tmp_path, "DEMO", [])

        assert JiraBackup(tmp_path, "DEMO").users() == {}

    def test_the_site_becomes_a_base_url(self, tmp_path):
        write_project(tmp_path, "DEMO", [])
        (tmp_path / "manifest.json").write_text(json.dumps({"site": "example.atlassian.net"}))

        assert JiraBackup(tmp_path, "DEMO").site() == "https://example.atlassian.net"

    def test_a_backup_naming_no_site_reports_none(self, tmp_path):
        write_project(tmp_path, "DEMO", [])

        assert JiraBackup(tmp_path, "DEMO").site() == ""
