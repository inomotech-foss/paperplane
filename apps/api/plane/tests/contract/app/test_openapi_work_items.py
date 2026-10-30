# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The work item endpoints return what the OpenAPI schema documents."""

from datetime import date

import pytest

from plane.db.models import (
    DraftIssue,
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueComment,
    IssueDescriptionVersion,
    IssueLabel,
    IssueVersion,
    Label,
    ProjectMember,
    State,
)
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="WI")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture
def issues(create_user, workspace, project):
    issue_type = link_starter_type(project)
    state = State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=workspace)
    label = Label.objects.create(name="bug", project=project, workspace=workspace)
    parent = Issue.objects.create(
        name="parent",
        project=project,
        workspace=workspace,
        type=issue_type,
        state=state,
        start_date=date(2026, 1, 1),
        created_by=create_user,
    )
    child = Issue.objects.create(
        name="child",
        project=project,
        workspace=workspace,
        type=issue_type,
        state=state,
        parent=parent,
        target_date=date(2026, 2, 1),
        created_by=create_user,
    )
    IssueAssignee.objects.create(issue=parent, assignee=create_user, project=project, workspace=workspace)
    IssueLabel.objects.create(issue=parent, label=label, project=project, workspace=workspace)
    IssueActivity.objects.create(
        issue=parent, project=project, workspace=workspace, actor=create_user, verb="created", field="name"
    )
    IssueComment.objects.create(
        issue=parent, project=project, workspace=workspace, actor=create_user, comment_html="<p>c</p>"
    )
    IssueVersion.objects.create(issue=parent, project=project, workspace=workspace, owned_by=create_user, name="v")
    IssueDescriptionVersion.objects.create(issue=parent, project=project, workspace=workspace, owned_by=create_user)
    return parent, child


def url(workspace, project, path=""):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/{path}"


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestWorkItemLists:
    def test_list_groupings(self, session_client, workspace, project, issues):
        base = url(workspace, project, "issues/")
        assert documented(session_client.get(base))["results"]
        assert documented(session_client.get(base, {"group_by": "state_id"}))["results"]
        assert documented(session_client.get(base, {"group_by": "labels__id"}))["results"]
        grouped = documented(session_client.get(base, {"group_by": "state_id", "sub_group_by": "priority"}))
        assert grouped["results"]

    def test_lists_by_id(self, session_client, workspace, project, issues):
        ids = ",".join(str(issue.id) for issue in issues)
        assert documented(session_client.get(url(workspace, project, "issues/list/"), {"issues": ids}))
        expanded = {"issues": ids, "fields": "id"}
        assert documented(session_client.get(url(workspace, project, "issues/list/"), expanded))
        assert documented(session_client.get(url(workspace, project, "issues-detail/")))["results"]
        detail = {"expand": "issue_relation,issue_related"}
        assert documented(session_client.get(url(workspace, project, "issues-detail/"), detail))["results"]
        assert documented(session_client.get(url(workspace, project, "v2/issues/")))["results"]
        assert documented(session_client.get(url(workspace, project, "v2/issues/"), {"description": "true"}))
        documented(session_client.get(url(workspace, project, "deleted-issues/")))

    def test_workspace_lists(self, session_client, create_user, workspace, project, issues):
        assert documented(session_client.get(f"/api/workspaces/{workspace.slug}/issues/"))["results"]
        user_issues = f"/api/workspaces/{workspace.slug}/user-issues/{create_user.id}/"
        assert documented(session_client.get(user_issues))["results"]
        assert documented(session_client.get(user_issues, {"group_by": "priority"}))["results"]
        search = {"search": "par", "workspace_search": "true"}
        assert documented(session_client.get(url(workspace, project, "search-issues/"), search))


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestWorkItemDetail:
    def test_crud(self, session_client, workspace, project, issues):
        parent, _ = issues
        body = {"name": "new", "type_id": str(parent.type_id)}
        created = documented(session_client.post(url(workspace, project, "issues/"), body, format="json"), 201)
        documented(session_client.get(url(workspace, project, f"issues/{parent.id}/")))
        response = session_client.patch(
            url(workspace, project, f"issues/{created['id']}/"), {"name": "b"}, format="json"
        )
        assert response.status_code == 204
        documented(session_client.get(f"/api/workspaces/{workspace.slug}/work-items/WI-{parent.sequence_id}/"))
        documented(session_client.get(url(workspace, project, f"issues/{parent.id}/meta/")))

    def test_history_and_versions(self, session_client, workspace, project, issues):
        parent, _ = issues
        history = documented(session_client.get(url(workspace, project, f"issues/{parent.id}/history/")))
        assert len(history) == 2
        versions = documented(session_client.get(url(workspace, project, f"issues/{parent.id}/versions/")))
        version_id = versions["results"][0]["id"]
        documented(session_client.get(url(workspace, project, f"issues/{parent.id}/versions/{version_id}/")))
        base = url(workspace, project, f"work-items/{parent.id}/description-versions/")
        versions = documented(session_client.get(base))
        documented(session_client.get(f"{base}{versions['results'][0]['id']}/"))

    def test_hierarchy(self, session_client, workspace, project, issues):
        parent, child = issues
        sub = url(workspace, project, f"issues/{parent.id}/sub-issues/")
        assert documented(session_client.get(sub))["sub_issues"]
        assert documented(session_client.get(sub, {"group_by": "priority"}))["sub_issues"]["none"]
        loose = Issue.objects.create(name="loose", project=project, workspace=project.workspace, type=parent.type)
        documented(session_client.post(sub, {"sub_issue_ids": [str(loose.id)]}, format="json"))
        rollups = documented(
            session_client.get(url(workspace, project, "issue-date-rollups/"), {"issue_ids": str(parent.id)})
        )
        assert rollups[str(parent.id)]["children_count"] == 2
        body = {"updates": [{"id": str(child.id), "start_date": "2026-01-10"}]}
        documented(session_client.post(url(workspace, project, "issue-dates/"), body, format="json"))

    def test_relations_and_subscribers(self, session_client, workspace, project, issues):
        parent, child = issues
        relation = url(workspace, project, f"issues/{parent.id}/issue-relation/")
        body = {"relation_type": "relates_to", "issues": [str(child.id)]}
        documented(session_client.post(relation, body, format="json"), 201)
        body = {"relation_type": "blocking", "issues": [str(child.id)]}
        documented(session_client.post(relation, body, format="json"), 201)
        assert documented(session_client.get(relation))["relates_to"]
        subscribe = url(workspace, project, f"issues/{parent.id}/subscribe/")
        documented(session_client.post(subscribe), 201)
        assert documented(session_client.get(subscribe))["subscribed"]
        assert documented(session_client.get(url(workspace, project, f"issues/{parent.id}/issue-subscribers/")))

    def test_comments_links_reactions(self, session_client, workspace, project, issues):
        parent, _ = issues
        base = url(workspace, project, f"issues/{parent.id}/")
        comment = documented(session_client.post(f"{base}comments/", {"comment_html": "<p>x</p>"}, format="json"), 201)
        assert documented(session_client.get(f"{base}comments/"))
        documented(
            session_client.patch(f"{base}comments/{comment['id']}/", {"comment_html": "<p>y</p>"}, format="json")
        )
        link = documented(session_client.post(f"{base}issue-links/", {"url": "https://a.example"}, format="json"), 201)
        assert documented(session_client.get(f"{base}issue-links/"))
        documented(session_client.patch(f"{base}issue-links/{link['id']}/", {"title": "t"}, format="json"))
        documented(session_client.post(f"{base}reactions/", {"reaction": "1f44d"}, format="json"), 201)
        assert documented(session_client.get(f"{base}reactions/"))
        reactions = url(workspace, project, f"comments/{comment['id']}/reactions/")
        documented(session_client.post(reactions, {"reaction": "1f44d"}, format="json"), 201)
        assert documented(session_client.get(reactions))

    def test_properties_and_labels(self, session_client, workspace, project, issues):
        parent, _ = issues
        values = documented(session_client.get(url(workspace, project, f"issues/{parent.id}/property-values/")))
        assert set(values) == {"values", "display", "derived"}
        documented(session_client.get(url(workspace, project, "issue-property-values/")))
        assert documented(session_client.get(url(workspace, project, "issue-labels/")))
        label = documented(
            session_client.post(url(workspace, project, "issue-labels/"), {"name": "x"}, format="json"), 201
        )
        documented(
            session_client.patch(url(workspace, project, f"issue-labels/{label['id']}/"), {"name": "y"}, format="json")
        )

    def test_archive(self, session_client, workspace, project, issues):
        parent, child = issues
        State.objects.filter(project=project).update(group="completed")
        documented(session_client.post(url(workspace, project, f"issues/{child.id}/archive/")))
        assert documented(session_client.get(url(workspace, project, "archived-issues/")))["results"]
        documented(session_client.get(url(workspace, project, f"issues/{child.id}/archive/")))
        body = {"issue_ids": [str(parent.id)]}
        documented(session_client.post(url(workspace, project, "bulk-archive-issues/"), body, format="json"))


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestWorkItemQueryAndDrafts:
    def test_query(self, session_client, workspace, project):
        base = f"/api/workspaces/{workspace.slug}/work-item-query"
        assert documented(session_client.get(f"{base}/fields/"))["fields"]
        assert documented(session_client.post(f"{base}/validate/", {"pql": "priority = high"}, format="json"))["valid"]
        assert "position" in documented(
            session_client.post(f"{base}/validate/", {"pql": "priority = ("}, format="json")
        )
        assert not documented(session_client.post(f"{base}/validate/", {"pql": "nope = 1"}, format="json"))["valid"]
        assert not documented(session_client.post(f"{base}/validate/", {}, format="json"))["valid"]

    def test_drafts(self, session_client, workspace, project):
        base = f"/api/workspaces/{workspace.slug}/draft-issues/"
        body = {"name": "draft", "project_id": str(project.id)}
        draft = documented(session_client.post(base, body, format="json"), 201)
        assert documented(session_client.get(base))["results"]
        documented(session_client.get(f"{base}{draft['id']}/"))
        response = session_client.patch(f"{base}{draft['id']}/", {"name": "d"}, format="json")
        assert response.status_code == 204
        issue_type = link_starter_type(project)
        to_issue = f"/api/workspaces/{workspace.slug}/draft-to-issue/{draft['id']}/"
        documented(session_client.post(to_issue, {"name": "d", "type_id": str(issue_type.id)}, format="json"), 201)
        assert not DraftIssue.objects.filter(pk=draft["id"]).exists()
