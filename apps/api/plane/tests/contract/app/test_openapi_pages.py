# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The page endpoints accept and return what the OpenAPI schema documents."""

import jsonschema
import pytest

from plane.db.models import (
    Label,
    Page,
    PageComment,
    PageIndexEntry,
    PageLabel,
    PageVersion,
    ProjectMember,
    ProjectPage,
)
from plane.tests.factories import ProjectFactory
from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import assert_no_content, documented_query, documented_request


@pytest.fixture
def project(create_user, workspace):
    project = ProjectFactory(workspace=workspace, identifier="PG")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture
def page(create_user, workspace, project):
    page = Page.objects.create(name="Root", workspace=workspace, owned_by=create_user, access=0)
    ProjectPage.objects.create(page=page, project=project, workspace=workspace)
    child = Page.objects.create(name="Child", workspace=workspace, owned_by=create_user, parent=page, access=0)
    ProjectPage.objects.create(page=child, project=project, workspace=workspace)
    label = Label.objects.create(name="spec", workspace=workspace)
    PageLabel.objects.create(page=page, label=label, workspace=workspace)
    PageVersion.objects.create(page=page, workspace=workspace, owned_by=create_user)
    PageComment.objects.create(page=page, workspace=workspace, actor=create_user, comment_html="<p>c</p>")
    for kind, key, value in [("property", "Owner", "Ann"), ("task", "", "Do it"), ("decision", "", "Yes")]:
        PageIndexEntry.objects.create(page=page, workspace=workspace, kind=kind, key=key, value=value)
    return page


def url(workspace, project, path=""):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/{path}"


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestPageResponses:
    def test_pages(self, session_client, workspace, project, page):
        assert documented(session_client.get(url(workspace, project, "pages/")))
        documented(session_client.get(url(workspace, project, f"pages/{page.id}/")))
        documented(session_client.post(url(workspace, project, "pages/"), {"name": "New"}, format="json"), 201)
        documented(session_client.patch(url(workspace, project, f"pages/{page.id}/"), {"name": "R"}, format="json"))
        documented(session_client.get(url(workspace, project, "pages-summary/")))
        documented(session_client.post(url(workspace, project, f"pages/{page.id}/duplicate/")), 201)

    def test_page_state(self, session_client, workspace, project, page):
        locked = session_client.post(url(workspace, project, f"pages/{page.id}/lock/"))
        assert locked.status_code == 204
        unlocked = session_client.delete(url(workspace, project, f"pages/{page.id}/lock/"))
        assert unlocked.status_code == 204
        access = session_client.post(url(workspace, project, f"pages/{page.id}/access/"), {"access": 1})
        assert access.status_code == 204
        documented(session_client.post(url(workspace, project, f"pages/{page.id}/archive/")))

    def test_description_and_versions(self, session_client, workspace, project, page):
        response = session_client.get(url(workspace, project, f"pages/{page.id}/description/"))
        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        body = {"description_html": "<p>x</p>"}
        documented(session_client.patch(url(workspace, project, f"pages/{page.id}/description/"), body, format="json"))
        versions = documented(session_client.get(url(workspace, project, f"pages/{page.id}/versions/")))
        documented(session_client.get(url(workspace, project, f"pages/{page.id}/versions/{versions[0]['id']}/")))

    def test_comments(self, session_client, workspace, project, page):
        base = url(workspace, project, f"pages/{page.id}/comments/")
        comment = documented(session_client.post(base, {"comment_html": "<p>x</p>"}, format="json"), 201)
        assert documented(session_client.get(base))
        documented(session_client.post(f"{base}{comment['id']}/resolve/"))
        documented(session_client.delete(f"{base}{comment['id']}/resolve/"))

    @pytest.mark.parametrize(
        "params",
        [
            {"kind": "recent"},
            {"kind": "index"},
            {"kind": "search", "search": "ro"},
            {"kind": "by-label", "labels": "spec"},
            {"kind": "label-list"},
            {"kind": "page-properties", "columns": "Owner"},
            {"kind": "task-report"},
            {"kind": "decision-report"},
            {"kind": "contributors"},
        ],
    )
    def test_query(self, session_client, workspace, page, params):
        assert documented(session_client.get(f"/api/workspaces/{workspace.slug}/page-query/", params))["results"]

    def test_query_tree(self, session_client, workspace, page):
        params = {"kind": "tree", "root_page_id": str(page.id)}
        assert documented(session_client.get(f"/api/workspaces/{workspace.slug}/page-query/", params))["results"]


BASE = "/api/workspaces/{slug}/projects/{project_id}"


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
class TestPageRequests:
    def test_create_and_update(self, session_client, workspace, project, page):
        ids = {"slug": workspace.slug, "project_id": project.id}
        body = {"name": "New", "access": 1, "parent": str(page.id), "description_html": "<p>hi</p>"}
        url, body = sent(BASE + "/pages/", "post", body, **ids)
        created = documented(session_client.post(url, body, format="json"), 201)
        assert (created["parent"], created["description_html"]) == (str(page.id), "<p>hi</p>")
        route = BASE + "/pages/{page_id}/"
        body = {"name": "Renamed", "logo_props": {"in_use": "emoji"}}
        url, body = sent(route, "patch", body, page_id=created["id"], **ids)
        assert documented(session_client.patch(url, body, format="json"))["name"] == "Renamed"
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "patch", {"parent": None})

    def test_access_and_description(self, session_client, workspace, project, page):
        ids = {"slug": workspace.slug, "project_id": project.id, "page_id": page.id}
        url, body = sent(BASE + "/pages/{page_id}/access/", "post", {"access": 1}, **ids)
        assert_no_content(session_client.post(url, body, format="json"))
        assert Page.objects.get(pk=page.id).access == 1
        body = {"description_html": "<p>x</p>", "description_json": {"type": "doc"}}
        url, body = sent(BASE + "/pages/{page_id}/description/", "patch", body, **ids)
        documented(session_client.patch(url, body, format="json"))

    def test_attachment_upload_body(self):
        route = "/api/assets/v2/workspaces/{slug}/projects/{project_id}/pages/{page_id}/attachments/"
        documented_request(route, "post", {"name": "a.png", "type": "image/png", "size": 10})
        with pytest.raises(jsonschema.ValidationError):
            documented_request(route, "post", {"asset": "a.png"})

    def test_query_parameters(self, session_client, workspace, project, page):
        assert documented_query(BASE + "/pages/", "get") == set()
        assert documented_query(BASE + "/pages/{page_id}/", "get") == {"track_visit"}
        url = (BASE + "/pages/{page_id}/").format(slug=workspace.slug, project_id=project.id, page_id=page.id)
        documented(session_client.get(url, {"track_visit": "false"}))
        expected = {"kind", "scope", "project_id", "root_page_id", "depth", "limit", "sort", "reverse", "search"}
        assert expected | {"labels", "columns", "status"} == documented_query(
            "/api/workspaces/{slug}/page-query/", "get"
        )
        params = {
            "kind": "index",
            "scope": "project",
            "project_id": str(project.id),
            "sort": "title",
            "reverse": "true",
        }
        assert documented(session_client.get(f"/api/workspaces/{workspace.slug}/page-query/", params))["results"]
