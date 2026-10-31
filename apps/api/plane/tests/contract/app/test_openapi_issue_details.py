# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The work item detail and taxonomy endpoints accept what the OpenAPI schema documents."""

from unittest import mock

import jsonschema
import pytest

from plane.db.models import Issue, IssueComment, ProjectMember
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import _schema, documented_query, documented_request
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="DET")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    link_starter_type(project)
    return project


@pytest.fixture
def issue(project, workspace):
    return Issue.objects.create(name="Detail", project=project, workspace=workspace, type=link_starter_type(project))


@pytest.fixture
def ids(workspace, project):
    return {"slug": workspace.slug, "project_id": project.id}


BASE = "/api/workspaces/{slug}/projects/{project_id}"


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestIssueDetailRequests:
    def test_comments(self, session_client, ids, issue):
        route = BASE + "/issues/{issue_id}/comments/"
        body = {"comment_html": "<p>hi</p>", "comment_json": {"type": "doc"}, "access": "EXTERNAL"}
        url, body = sent(route, "post", body, issue_id=issue.id, **ids)
        comment = documented(session_client.post(url, body, format="json"), 201)
        assert comment["access"] == "EXTERNAL"
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "post", {"comment_html": "<p>x</p>", "actor": str(issue.id)})
        url, body = sent(
            route + "{pk}/", "patch", {"comment_html": "<p>edited</p>"}, issue_id=issue.id, pk=comment["id"], **ids
        )
        assert documented(session_client.patch(url, body, format="json"))["comment_html"] == "<p>edited</p>"

    def test_comment_put_is_refused(self, session_client, ids, issue):
        route = BASE + "/issues/{issue_id}/comments/{pk}/"
        comment = IssueComment.objects.create(issue=issue, project=issue.project, comment_html="<p>a</p>")
        url = route.format(issue_id=issue.id, pk=comment.id, **ids)
        assert session_client.put(url, {"comment_html": "<p>b</p>"}, format="json").status_code == 405

    def test_reactions(self, session_client, ids, issue):
        url, body = sent(
            BASE + "/issues/{issue_id}/reactions/", "post", {"reaction": "128077"}, issue_id=issue.id, **ids
        )
        documented(session_client.post(url, body, format="json"), 201)
        comment = IssueComment.objects.create(issue=issue, project=issue.project, comment_html="<p>a</p>")
        route = BASE + "/comments/{comment_id}/reactions/"
        url, body = sent(route, "post", {"reaction": "128077"}, comment_id=comment.id, **ids)
        documented(session_client.post(url, body, format="json"), 201)

    def test_history_parameters(self, session_client, ids, issue):
        route = BASE + "/issues/{issue_id}/history/"
        assert {"activity_type", "created_at__gt"} <= documented_query(route, "get")
        IssueComment.objects.create(issue=issue, project=issue.project, comment_html="<p>a</p>")
        url = route.format(issue_id=issue.id, **ids)
        comments = documented(session_client.get(url, {"activity_type": "issue-comment"}))
        assert [entry["comment_html"] for entry in comments] == ["<p>a</p>"]
        later = documented(session_client.get(url, {"activity_type": "issue-comment", "created_at__gt": "2999-01-01"}))
        assert later == []

    def test_attachment_upload(self, session_client, ids, issue):
        route = "/api/assets/v2/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/attachments/"
        url, body = sent(route, "post", {"name": "a.png", "type": "image/png", "size": 10}, issue_id=issue.id, **ids)
        with mock.patch("plane.app.views.issue.attachment.S3Storage") as storage:
            storage.return_value.generate_presigned_post.return_value = {"url": "https://s3.test", "fields": {}}
            upload = documented(session_client.post(url, body, format="json"))
        assert "requestBody" not in _schema("internal")["paths"][route + "{pk}/"]["patch"]
        detail = (route + "{pk}/").format(issue_id=issue.id, pk=upload["asset_id"], **ids)
        assert session_client.patch(detail).status_code == 204

    def test_query_validate(self, session_client, workspace, project):
        route = "/api/workspaces/{slug}/work-item-query/validate/"
        url, body = sent(
            route, "post", {"pql": 'priority = "high"', "project_id": str(project.id)}, slug=workspace.slug
        )
        assert documented(session_client.post(url, body, format="json"))["valid"] is True


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestTaxonomyRequests:
    def test_properties(self, session_client, ids, issue):
        body = {"name": "Size", "display_name": "Size", "property_type": "OPTION", "options": [{"name": "S"}]}
        url, body = sent(BASE + "/issue-properties/", "post", body, **ids)
        created = documented(session_client.post(url, body, format="json"), 201)
        assert [option["name"] for option in created["options"]] == ["S"]
        assert {"issue_type", "unscoped"} <= documented_query(BASE + "/issue-properties/", "get")
        values = {created["id"]: created["options"][0]["id"]}
        url, body = sent(BASE + "/issues/{issue_id}/property-values/", "put", values, issue_id=issue.id, **ids)
        assert documented(session_client.put(url, body, format="json"))["values"]
        route = BASE + "/issue-property-values/"
        assert documented_query(route, "get") == {"issue_ids"}
        bulk = documented(session_client.get(route.format(**ids), {"issue_ids": str(issue.id)}))
        assert set(bulk) == {str(issue.id)}

    def test_bulk_labels(self, session_client, ids):
        body = {"label_data": [{"name": "a"}, {"name": "b", "description": "B"}]}
        url, body = sent(BASE + "/bulk-create-labels/", "post", body, **ids)
        labels = documented(session_client.post(url, body, format="json"), 201)["labels"]
        assert sorted(label["name"] for label in labels) == ["a", "b"]

    def test_estimates(self, session_client, ids):
        body = {
            "estimate": {"name": "Points", "type": "points"},
            "estimate_points": [{"key": 1, "value": "1"}, {"key": 2, "value": "2"}],
        }
        url, body = sent(BASE + "/estimates/", "post", body, **ids)
        estimate = documented(session_client.post(url, body, format="json"))
        assert estimate["type"] == "points"
        point = estimate["points"][0]
        route = BASE + "/estimates/{estimate_id}/"
        update = {"estimate": {"name": "Renamed"}, "estimate_points": [{"id": point["id"], "value": "3"}]}
        url, body = sent(route, "patch", update, estimate_id=estimate["id"], **ids)
        assert documented(session_client.patch(url, body, format="json"))["name"] == "Renamed"
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "patch", {"estimate": {"name": "x"}})
        points = route + "estimate-points/"
        url, body = sent(points, "post", {"key": 3, "value": "5"}, estimate_id=estimate["id"], **ids)
        created = documented(session_client.post(url, body, format="json"))
        url, body = sent(
            points + "{estimate_point_id}/",
            "patch",
            {"value": "8"},
            estimate_id=estimate["id"],
            estimate_point_id=created["id"],
            **ids,
        )
        assert documented(session_client.patch(url, body, format="json"))["value"] == "8"

    def test_time_estimate_keeps_its_type(self, session_client, ids):
        body = {"estimate": {"name": "Time", "type": "time"}, "estimate_points": [{"key": 1, "value": "60"}]}
        url, body = sent(BASE + "/estimates/", "post", body, **ids)
        estimate = documented(session_client.post(url, body, format="json"))
        assert estimate["type"] == "time"
        listed = documented(session_client.get(url))
        assert [item["type"] for item in listed] == ["time"]
