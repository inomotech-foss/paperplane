# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest
from django.utils import timezone

from plane.db.models import Issue
from plane.importers.jira.backup import JiraBackup
from plane.importers.jira.loader import JiraLoader


def write_backup(root):
    project_dir = root / "jira" / "DEMO"
    project_dir.mkdir(parents=True)
    (project_dir / "project.json").write_text(json.dumps({"key": "DEMO", "name": "Demo"}))
    issue = {
        "key": "DEMO-1",
        "fields": {
            "summary": "Rotate the signing keys",
            "status": {"name": "To Do", "statusCategory": {"key": "new"}},
            "issuetype": {"name": "Task"},
            "created": "2024-01-01T10:00:00.000+0000",
            "updated": "2024-02-01T10:00:00.000+0000",
        },
    }
    (project_dir / "issues.jsonl").write_text(json.dumps(issue) + "\n")
    (root / "user_mapping.json").write_text("[]")
    return JiraBackup(root, "DEMO")


@pytest.fixture
def loader(workspace, create_user, tmp_path):
    return JiraLoader(workspace.slug, create_user, write_backup(tmp_path), storage=object())


def the_issue():
    return Issue.objects.get(external_source="jira", external_id="DEMO-1")


@pytest.mark.unit
@pytest.mark.django_db
class TestKeep:
    def test_an_untouched_issue_follows_the_backup(self, loader):
        loader.run()
        issue = the_issue()
        Issue.objects.filter(pk=issue.pk).update(name="Renamed", updated_at=issue.updated_at)

        summary = loader.run()

        assert the_issue().name == "Rotate the signing keys"
        assert summary.kept == 0

    def test_an_issue_changed_in_plane_is_left_alone(self, loader):
        loader.run()
        Issue.objects.filter(pk=the_issue().pk).update(name="Renamed", updated_at=timezone.now())

        summary = loader.run()

        assert the_issue().name == "Renamed"
        assert summary.kept == 1
