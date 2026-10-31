# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The work item endpoints accept what the OpenAPI schema documents."""

import jsonschema
import pytest

from plane.db.models import (
    DraftIssue,
    Issue,
    IssueRelation,
    IssueType,
    ProjectIdentifier,
    ProjectMember,
    State,
)
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import assert_no_content, documented_query, documented_request
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="WI")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    link_starter_type(project)
    ProjectIdentifier.objects.create(name="WI", project=project, workspace=workspace)
    return project


def make_issue(project, name="Item", **fields):
    return Issue.objects.create(
        name=name, project=project, workspace=project.workspace, type=link_starter_type(project), **fields
    )


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


BASE = "/api/workspaces/{slug}/projects/{project_id}"


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestIssueRequests:
    def test_create_and_update(self, session_client, workspace, project):
        ids = {"slug": workspace.slug, "project_id": project.id}
        body = {"name": "New", "type_id": str(link_starter_type(project).id), "priority": "high"}
        url, body = sent(BASE + "/issues/", "post", body, **ids)
        created = documented(session_client.post(url, body, format="json"), 201)
        route = BASE + "/issues/{pk}/"
        body = {"description_html": "<p>x</p>", "skip_activity": True}
        url, body = sent(route, "patch", body, pk=created["id"], **ids)
        assert_no_content(session_client.patch(url, body, format="json"))
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "patch", {"skip_activity": "true"})

    def test_bulk_bodies(self, session_client, workspace, project):
        ids = {"slug": workspace.slug, "project_id": project.id}
        done = State.objects.create(name="Done", group="completed", project=project, workspace=workspace)
        archived, deleted = make_issue(project, "a", state=done), make_issue(project, "b")
        url, body = sent(BASE + "/bulk-archive-issues/", "post", {"issue_ids": [str(archived.id)]}, **ids)
        documented(session_client.post(url, body, format="json"))
        url, body = sent(BASE + "/bulk-delete-issues/", "delete", {"issue_ids": [str(deleted.id)]}, **ids)
        documented(session_client.delete(url, body, format="json"))
        dated = make_issue(project, "c")
        updates = {"updates": [{"id": str(dated.id), "start_date": "2026-01-01", "target_date": "2026-01-31"}]}
        url, body = sent(BASE + "/issue-dates/", "post", updates, **ids)
        documented(session_client.post(url, body, format="json"))
        dated.refresh_from_db()
        assert str(dated.target_date) == "2026-01-31"

    def test_relations_and_sub_issues(self, session_client, workspace, project):
        parent, child = make_issue(project, "p"), make_issue(project, "c")
        ids = {"slug": workspace.slug, "project_id": project.id, "issue_id": parent.id}
        route = BASE + "/issues/{issue_id}/issue-relation/"
        url, body = sent(route, "post", {"relation_type": "blocking", "issues": [str(child.id)]}, **ids)
        assert session_client.post(url, body, format="json").status_code == 201
        assert IssueRelation.objects.filter(issue=child, related_issue=parent, relation_type="blocked_by").exists()
        route = BASE + "/issues/{issue_id}/remove-relation/"
        url, body = sent(route, "post", {"related_issue": str(child.id)}, **ids)
        assert_no_content(session_client.post(url, body, format="json"))
        route = BASE + "/issues/{issue_id}/sub-issues/"
        url, body = sent(route, "post", {"sub_issue_ids": [str(child.id)]}, **ids)
        documented(session_client.post(url, body, format="json"))
        child.refresh_from_db()
        assert child.parent_id == parent.id

    def test_drafts(self, session_client, workspace, project):
        route = "/api/workspaces/{slug}/draft-issues/"
        url, body = sent(route, "post", {"name": "Draft", "project_id": str(project.id)}, slug=workspace.slug)
        draft = documented(session_client.post(url, body, format="json"), 201)
        route = "/api/workspaces/{slug}/draft-issues/{pk}/"
        url, body = sent(route, "patch", {"name": "Renamed", "priority": "low"}, slug=workspace.slug, pk=draft["id"])
        assert_no_content(session_client.patch(url, body, format="json"))
        assert DraftIssue.objects.get(pk=draft["id"]).name == "Renamed"
        route = "/api/workspaces/{slug}/draft-to-issue/{draft_id}/"
        body = {"name": "Renamed", "type_id": str(link_starter_type(project).id)}
        url, body = sent(route, "post", body, slug=workspace.slug, draft_id=draft["id"])
        documented(session_client.post(url, body, format="json"), 201)

    def test_draft_keeps_its_type(self, session_client, workspace, project):
        type_id = str(link_starter_type(project).id)
        route = "/api/workspaces/{slug}/draft-issues/"
        body = {"name": "Typed", "project_id": str(project.id), "type_id": type_id}
        url, body = sent(route, "post", body, slug=workspace.slug)
        draft = documented(session_client.post(url, body, format="json"), 201)
        assert draft["type_id"] == type_id
        assert str(DraftIssue.objects.get(pk=draft["id"]).type_id) == type_id
        unlinked = IssueType.objects.create(workspace=workspace, name="Unlinked")
        body = {**body, "type_id": str(unlinked.id)}
        assert session_client.post(url, body, format="json").status_code == 400

    def test_list_query_parameters(self, session_client, workspace, project):
        make_issue(project)
        route = BASE + "/issues/"
        expected = {"cursor", "per_page", "group_by", "sub_group_by", "order_by", "sub_issue", "filters", "pql"}
        assert expected | {"layout", "state", "priority", "target_date"} <= documented_query(route, "get")
        url = route.format(slug=workspace.slug, project_id=project.id)
        params = {"group_by": "priority", "order_by": "-created_at", "sub_issue": "false", "per_page": 10}
        assert documented(session_client.get(url, {**params, "cursor": "10:1:0", "priority": "none"}))
        assert {"issues", "fields", "expand"} <= documented_query(BASE + "/issues/list/", "get")
        assert {"issue_ids"} <= documented_query(BASE + "/issue-date-rollups/", "get")
        assert {"updated_at__gt"} <= documented_query(BASE + "/deleted-issues/", "get")
        assert {"expand"} <= documented_query(BASE + "/issues/{pk}/", "get")
        archived = documented_query(BASE + "/archived-issues/", "get")
        assert {"group_by", "sub_issue", "filters", "show_sub_issues"} <= archived

    def test_profile_query_parameters(self, session_client, create_user, workspace, project):
        make_issue(project)
        route = "/api/workspaces/{slug}/user-issues/{user_id}/"
        assert {"cursor", "per_page", "group_by", "filters", "sub_issue"} <= documented_query(route, "get")
        route = "/api/workspaces/{slug}/user-activity/{user_id}/"
        assert {"cursor", "per_page", "project"} <= documented_query(route, "get")
        url = route.format(slug=workspace.slug, user_id=create_user.id)
        assert documented(session_client.get(url, {"per_page": 10, "project": [str(project.id)]})) is not None
