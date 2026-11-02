# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO

import pytest
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext

from plane.db.management.commands.report_missing_creators import missing_creators
from plane.db.models import Issue, IssueActivity, Label, Page, Project, State, Workspace
from plane.utils.issue_type import link_starter_type

pytestmark = pytest.mark.unit


@pytest.mark.django_db
def test_counts_null_creators_and_inferable_ones(workspace, create_user):
    project = Project.objects.create(name="Damage", identifier="DMG", workspace=workspace)
    state = State.objects.create(name="Todo", project=project, group="backlog", default=True)
    issue_type = link_starter_type(project)
    inferable = Issue.objects.create(name="Has activity", project=project, state=state, type=issue_type)
    Issue.objects.create(name="No activity", project=project, state=state, type=issue_type)
    IssueActivity.objects.create(issue=inferable, project=project, verb="created", actor=create_user)
    label = Label.objects.create(name="Orphan", project=project)
    page = Page.objects.create(name="Owned", workspace=workspace, owned_by=create_user)

    Workspace.objects.filter(pk=workspace.pk).update(created_by=None)
    Issue.all_objects.filter(project=project).update(created_by=None)
    Label.objects.filter(pk=label.pk).update(created_by=None)
    Page.all_objects.filter(pk=page.pk).update(created_by=None)
    before = {row.pk: row.created_by_id for row in Issue.all_objects.filter(project=project)}

    with CaptureQueriesContext(connection) as queries:
        rows = {name: (count, inferred) for name, count, inferred in missing_creators()}
    assert queries.captured_queries
    assert all(query["sql"].lstrip().upper().startswith("SELECT") for query in queries.captured_queries)

    assert rows["Workspace"] == (1, 1)
    assert rows["Issue"] == (2, 1)
    assert rows["Label"] == (1, None)
    assert rows["Page"] == (1, 1)
    assert {row.pk: row.created_by_id for row in Issue.all_objects.filter(project=project)} == before

    out = StringIO()
    with CaptureQueriesContext(connection) as queries:
        call_command("report_missing_creators", stdout=out)
    assert "Issue" in out.getvalue()
    allowed = ("SELECT", "SAVEPOINT", "RELEASE SAVEPOINT", "SET TRANSACTION READ ONLY")
    assert all(query["sql"].lstrip().upper().startswith(allowed) for query in queries.captured_queries)
