# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.importers.confluence.backup import ConfluenceBackup, space_keys
from plane.importers.confluence.report import report_backup, report_space

PLAIN = "<p>Nothing unusual here.</p>"
IMAGE = '<p><ac:image><ri:attachment ri:filename="{filename}"/></ac:image></p>'
UNSUPPORTED = '<ac:structured-macro ac:name="livesearch"/>'
# A multi-cell section with no ac:type is a shape the columns mapping does not
# describe, so it flattens and counts as loss.
LAYOUT = (
    "<ac:layout><ac:layout-section>"
    "<ac:layout-cell><p>Left</p></ac:layout-cell><ac:layout-cell><p>Right</p></ac:layout-cell>"
    "</ac:layout-section></ac:layout>"
)
CROSS_SPACE_LINK = '<p><ac:link><ri:page ri:space-key="ENG" ri:content-title="Runbook"/></ac:link></p>'
SINGLE_CELL_LAYOUT = (
    "<ac:layout><ac:layout-section><ac:layout-cell><p>One</p></ac:layout-cell></ac:layout-section></ac:layout>"
)


def write_space(root, key, pages, name="Space", users=None):
    """Builds the slice of a backup tree the report reads."""
    space_dir = root / "confluence" / key
    space_dir.mkdir(parents=True)
    (space_dir / "space.json").write_text(json.dumps({"key": key, "name": name}))

    records = [
        {
            "id": page["id"],
            "title": page["title"],
            "body": {"storage": {"value": page["body"]}},
        }
        for page in pages
    ]
    (space_dir / "pages.jsonl").write_text("\n".join(json.dumps(record) for record in records))

    if users is not None:
        (root / "user_mapping.json").write_text(json.dumps(users))

    return space_dir


def add_attachment(space_dir, page_id, filename):
    directory = space_dir / "attachments" / page_id
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(b"stub")


@pytest.mark.unit
class TestSpaceKeys:
    def test_lists_only_directories_holding_a_space(self, tmp_path):
        write_space(tmp_path, "IMS", [])
        write_space(tmp_path, "ENG", [])
        (tmp_path / "confluence" / "half-copied").mkdir()

        assert space_keys(tmp_path) == ["ENG", "IMS"]

    def test_a_missing_backup_is_not_an_error(self, tmp_path):
        assert space_keys(tmp_path) == []


@pytest.mark.unit
class TestReportSpace:
    def test_prose_converts_with_nothing_lost(self, tmp_path):
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Policy", "body": PLAIN}])

        report = report_space(ConfluenceBackup(tmp_path, "IMS"))

        assert report.pages == 1
        assert report.lossless == 1
        assert report.fidelity == 1.0
        assert report.worst == []

    def test_an_image_backed_by_a_real_file_is_not_a_loss(self, tmp_path):
        """The resolvers answer from the backup, so an attachment that was
        actually captured must not be counted as missing."""
        page = {"id": "1", "title": "Policy", "body": IMAGE.format(filename="a.png")}
        space_dir = write_space(tmp_path, "IMS", [page])
        add_attachment(space_dir, "1", "a.png")

        report = report_space(ConfluenceBackup(tmp_path, "IMS"))

        assert report.lossless == 1
        assert report.unresolved_attachments == set()

    def test_an_image_with_no_backed_up_file_is_counted(self, tmp_path):
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Policy", "body": IMAGE.format(filename="gone.png")}])

        report = report_space(ConfluenceBackup(tmp_path, "IMS"))

        assert report.lossless == 0
        assert report.unresolved_attachments == {"gone.png"}
        assert report.worst[0].title == "Policy"

    def test_unsupported_macros_are_counted_by_name(self, tmp_path):
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Board", "body": UNSUPPORTED}])

        report = report_space(ConfluenceBackup(tmp_path, "IMS"))

        assert report.unsupported_macros["livesearch"] == 1
        assert report.lossless == 0

    def test_unmappable_layouts_are_counted(self, tmp_path):
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Two column", "body": LAYOUT}])

        report = report_space(ConfluenceBackup(tmp_path, "IMS"))

        assert report.dropped_layouts == 1
        assert report.lossless == 0

    def test_a_single_column_layout_loses_nothing(self, tmp_path):
        write_space(tmp_path, "IMS", [{"id": "1", "title": "One column", "body": SINGLE_CELL_LAYOUT}])

        report = report_space(ConfluenceBackup(tmp_path, "IMS"))

        assert report.dropped_layouts == 0
        assert report.lossless == 1

    def test_worst_pages_come_first(self, tmp_path):
        write_space(
            tmp_path,
            "IMS",
            [
                {"id": "1", "title": "One macro", "body": UNSUPPORTED},
                {"id": "2", "title": "Three macros", "body": UNSUPPORTED * 3},
                {"id": "3", "title": "Clean", "body": PLAIN},
            ],
        )

        report = report_space(ConfluenceBackup(tmp_path, "IMS"))

        assert [page.title for page in report.worst] == ["Three macros", "One macro"]
        assert report.worst[0].loss == 3

    def test_limit_scores_only_the_first_pages(self, tmp_path):
        write_space(
            tmp_path,
            "IMS",
            [
                {"id": "1", "title": "Clean", "body": PLAIN},
                {"id": "2", "title": "Broken", "body": UNSUPPORTED},
            ],
        )

        report = report_space(ConfluenceBackup(tmp_path, "IMS"), limit=1)

        assert report.pages == 1
        assert report.fidelity == 1.0

    def test_an_empty_space_scores_as_clean(self, tmp_path):
        write_space(tmp_path, "EMPTY", [])

        report = report_space(ConfluenceBackup(tmp_path, "EMPTY"))

        assert report.pages == 0
        assert report.fidelity == 1.0


@pytest.mark.unit
class TestReportBackup:
    def test_spaces_are_ordered_worst_fidelity_first(self, tmp_path):
        write_space(tmp_path, "CLEAN", [{"id": "1", "title": "Policy", "body": PLAIN}])
        write_space(tmp_path, "MESSY", [{"id": "2", "title": "Board", "body": UNSUPPORTED}])

        reports = report_backup(tmp_path)

        assert [report.key for report in reports] == ["MESSY", "CLEAN"]

    def test_equal_fidelity_puts_the_larger_space_first(self, tmp_path):
        """Two spaces that convert equally well are not equally urgent - the one
        with more pages is the bigger migration."""
        write_space(tmp_path, "SMALL", [{"id": "1", "title": "A", "body": PLAIN}])
        big = [{"id": "2", "title": "B", "body": PLAIN}, {"id": "3", "title": "C", "body": PLAIN}]
        write_space(tmp_path, "BIG", big)

        reports = report_backup(tmp_path)

        assert [report.key for report in reports] == ["BIG", "SMALL"]

    def test_a_named_space_is_scored_alone(self, tmp_path):
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Policy", "body": PLAIN}])
        write_space(tmp_path, "ENG", [{"id": "2", "title": "Board", "body": UNSUPPORTED}])

        reports = report_backup(tmp_path, spaces=["IMS"])

        assert [report.key for report in reports] == ["IMS"]

    def test_a_link_into_another_space_in_the_run_resolves(self, tmp_path):
        """Confluence links pages by title and titles cross spaces, so scoring a
        space on its own titles alone invents broken links."""
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Policy", "body": CROSS_SPACE_LINK}])
        write_space(tmp_path, "ENG", [{"id": "2", "title": "Runbook", "body": PLAIN}])

        report = next(report for report in report_backup(tmp_path) if report.key == "IMS")

        assert report.unresolved_pages == set()
        assert report.lossless == 1

    def test_a_single_space_run_does_not_see_the_rest_by_default(self, tmp_path):
        """The default matches an import of exactly the spaces named."""
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Policy", "body": CROSS_SPACE_LINK}])
        write_space(tmp_path, "ENG", [{"id": "2", "title": "Runbook", "body": PLAIN}])

        reports = report_backup(tmp_path, spaces=["IMS"])

        assert reports[0].unresolved_pages == {"Runbook"}

    def test_the_global_page_map_reaches_spaces_outside_the_run(self, tmp_path):
        write_space(tmp_path, "IMS", [{"id": "1", "title": "Policy", "body": CROSS_SPACE_LINK}])
        write_space(tmp_path, "ENG", [{"id": "2", "title": "Runbook", "body": PLAIN}])

        reports = report_backup(tmp_path, spaces=["IMS"], global_page_map=True)

        assert reports[0].unresolved_pages == set()
