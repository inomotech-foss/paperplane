# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.importers.jira.backup import JiraBackup
from plane.importers.jira.report import report_backup, report_project

USERS = [{"accountId": "account-1", "displayName": "Ada Sample"}]


def document(*content):
    return {"type": "doc", "version": 1, "content": list(content)}


def prose(value):
    return document({"type": "paragraph", "content": [{"type": "text", "text": value}]})


PLAIN = prose("Nothing unusual here.")
UNKNOWN = document({"type": "decisionList", "content": []})
CARD = document({"type": "blockCard", "attrs": {"url": "https://example.com/plan"}})
IMAGE = document(
    {
        "type": "mediaSingle",
        "content": [{"type": "media", "attrs": {"type": "file", "id": "media-1", "alt": "{filename}"}}],
    }
)


def issue(key, description=None, comments=(), summary="Rotate the signing keys"):
    return {
        "key": key,
        "fields": {
            "summary": summary,
            "description": description,
            "comment": {"comments": [{"id": str(index), "body": body} for index, body in enumerate(comments)]},
        },
    }


def write_project(root, key, issues, name="Demo", users=USERS):
    project_dir = root / "jira" / key
    project_dir.mkdir(parents=True)
    (project_dir / "project.json").write_text(json.dumps({"key": key, "name": name}))
    (project_dir / "issues.jsonl").write_text("\n".join(json.dumps(item) for item in issues))
    (root / "user_mapping.json").write_text(json.dumps(users))
    return project_dir


def add_attachment(project_dir, issue_key, filename):
    directory = project_dir / "attachments" / issue_key
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(b"stub")


def media_document(filename):
    return json.loads(json.dumps(IMAGE).replace("{filename}", filename))


def nameless_media_document(count=1):
    """What most of the backup's inline media looks like: an id and nothing to
    match a file on."""
    return document(
        *(
            {
                "type": "mediaSingle",
                "content": [{"type": "media", "attrs": {"type": "file", "id": f"media-{index}"}}],
            }
            for index in range(count)
        )
    )


@pytest.mark.unit
class TestReportProject:
    def test_prose_converts_with_nothing_lost(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", PLAIN)])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert (report.key, report.name) == ("DEMO", "Demo")
        assert (report.issues, report.lossless, report.documents) == (1, 1, 1)
        assert report.fidelity == 1.0
        assert report.worst == []

    def test_comments_are_scored_with_the_description(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", PLAIN, comments=[PLAIN, PLAIN])])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.documents == 3
        assert report.nodes.converted["paragraph"] == 3

    def test_a_node_outside_the_inventory_is_named(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", UNKNOWN)])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.nodes.lost == {"decisionList": 1}
        assert report.lossless == 0
        assert [item.key for item in report.worst] == ["DEMO-1"]

    def test_a_downgrade_is_not_a_loss(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", CARD)])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.nodes.downgraded == {"blockCard": 1}
        assert report.lossless == 1

    def test_an_attachment_on_disk_resolves(self, tmp_path):
        project_dir = write_project(tmp_path, "DEMO", [issue("DEMO-1", media_document("diagram.png"))])
        add_attachment(project_dir, "DEMO-1", "diagram.png")

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.unresolved_attachments == set()
        assert report.nodes.converted["media"] == 1

    def test_an_attachment_missing_from_disk_is_named(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", media_document("missing.png"))])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.unresolved_attachments == {"missing.png"}
        assert report.lossless == 0

    def test_a_lone_attachment_places_a_lone_nameless_media_node(self, tmp_path):
        project_dir = write_project(tmp_path, "DEMO", [issue("DEMO-1", nameless_media_document())])
        add_attachment(project_dir, "DEMO-1", "diagram.png")

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.inferred_media == 1
        assert report.unresolved_media == 0
        assert report.lossless == 1

    def test_a_lone_attachment_is_not_spread_over_several_media_nodes(self, tmp_path):
        project_dir = write_project(tmp_path, "DEMO", [issue("DEMO-1", nameless_media_document(count=3))])
        add_attachment(project_dir, "DEMO-1", "diagram.png")

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.inferred_media == 0
        assert report.unresolved_media == 3
        assert report.lossless == 0

    def test_several_attachments_leave_a_nameless_media_node_unresolved(self, tmp_path):
        project_dir = write_project(tmp_path, "DEMO", [issue("DEMO-1", nameless_media_document())])
        add_attachment(project_dir, "DEMO-1", "diagram.png")
        add_attachment(project_dir, "DEMO-1", "chart.png")

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.inferred_media == 0
        assert report.unresolved_media == 1

    def test_a_dropped_inline_image_is_counted_as_a_loss(self, tmp_path):
        """The file still reaches the attachment list, but its placement in the
        body text does not, and a fidelity score that hid that would be wrong."""
        write_project(tmp_path, "DEMO", [issue("DEMO-1", nameless_media_document())])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.nodes.lost == {"media": 1}
        assert report.unresolved_media == 1
        assert report.fidelity == 0.0
        # doc + mediaSingle + media, with the image counted as the loss.
        assert report.nodes.total == 3

    def test_the_fallback_spans_the_comments_as_well_as_the_description(self, tmp_path):
        project_dir = write_project(
            tmp_path, "DEMO", [issue("DEMO-1", nameless_media_document(), comments=[nameless_media_document()])]
        )
        add_attachment(project_dir, "DEMO-1", "diagram.png")

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.inferred_media == 0
        assert report.unresolved_media == 2

    def test_a_mention_the_backup_knows_resolves(self, tmp_path):
        mention = document({"type": "paragraph", "content": [{"type": "mention", "attrs": {"id": "account-1"}}]})
        write_project(tmp_path, "DEMO", [issue("DEMO-1", mention)])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert report.unresolved_users == set()
        assert report.nodes.converted["mention"] == 1

    def test_worst_issues_come_first(self, tmp_path):
        heavy = document({"type": "decisionList"}, {"type": "decisionItem"})
        write_project(tmp_path, "DEMO", [issue("DEMO-1", UNKNOWN), issue("DEMO-2", heavy)])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert [item.key for item in report.worst] == ["DEMO-2", "DEMO-1"]

    def test_the_limit_stops_early(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue(f"DEMO-{index}", PLAIN) for index in range(5)])

        assert report_project(JiraBackup(tmp_path, "DEMO"), limit=2).issues == 2

    def test_an_issue_without_a_description_scores_clean(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1")])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        assert (report.issues, report.documents, report.lossless) == (1, 0, 1)

    def test_the_buckets_add_up_to_the_node_count(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", CARD, comments=[UNKNOWN, PLAIN])])

        report = report_project(JiraBackup(tmp_path, "DEMO"))

        # doc + blockCard, doc + decisionList, doc + paragraph + text
        assert report.nodes.total == 7


@pytest.mark.unit
class TestReportBackup:
    def test_projects_are_ordered_worst_first(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", UNKNOWN)])
        write_project(tmp_path, "WIKI", [issue("WIKI-1", PLAIN)])

        reports = report_backup(tmp_path)

        assert [report.key for report in reports] == ["DEMO", "WIKI"]

    def test_a_named_project_is_the_only_one_read(self, tmp_path):
        write_project(tmp_path, "DEMO", [issue("DEMO-1", PLAIN)])
        write_project(tmp_path, "WIKI", [issue("WIKI-1", PLAIN)])

        assert [report.key for report in report_backup(tmp_path, projects=["WIKI"])] == ["WIKI"]

    def test_an_empty_backup_reports_nothing(self, tmp_path):
        assert report_backup(tmp_path) == []
