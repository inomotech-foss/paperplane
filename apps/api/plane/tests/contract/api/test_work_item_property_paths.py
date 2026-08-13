# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The property routes the Plane SDK addresses: scoped under a work item type,
and one property's value on one work item."""

import pytest
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyOption,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    PropertyTypeChoices,
    State,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def bug_type(db, workspace, project):
    issue_type = IssueType.objects.create(workspace=workspace, name="Bug")
    ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return issue_type


@pytest.fixture
def issue(db, workspace, project, create_user):
    state = State.objects.create(name="Todo", project=project, workspace=workspace)
    return Issue.objects.create(
        name="Work item", project=project, workspace=workspace, state=state, created_by=create_user
    )


@pytest.fixture
def text_property(db, workspace, project):
    return IssueProperty.objects.create(
        name="Owner note",
        display_name="Owner note",
        property_type=PropertyTypeChoices.TEXT,
        project=project,
        workspace=workspace,
    )


@pytest.fixture
def multi_property(db, workspace, project):
    issue_property = IssueProperty.objects.create(
        name="Tags",
        display_name="Tags",
        property_type=PropertyTypeChoices.OPTION,
        is_multi=True,
        project=project,
        workspace=workspace,
    )
    for name in ("Red", "Blue"):
        IssuePropertyOption.objects.create(property=issue_property, name=name, project=project, workspace=workspace)
    return issue_property


def type_property_url(slug, project_id, type_id, property_id=None):
    url = f"/api/v1/workspaces/{slug}/projects/{project_id}/work-item-types/{type_id}/work-item-properties/"
    return f"{url}{property_id}/" if property_id else url


def value_url(slug, project_id, work_item_id, property_id):
    return (
        f"/api/v1/workspaces/{slug}/projects/{project_id}/work-items/{work_item_id}"
        f"/work-item-properties/{property_id}/values/"
    )


@pytest.mark.contract
class TestTypeScopedProperties:
    @pytest.mark.django_db
    def test_create_under_a_type_scopes_the_property(self, api_key_client, workspace, project, bug_type):
        response = api_key_client.post(
            type_property_url(workspace.slug, project.id, bug_type.id),
            {"name": "Severity", "property_type": "TEXT"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert IssueProperty.objects.get(pk=response.data["id"]).issue_type_id == bug_type.id

    @pytest.mark.django_db
    def test_the_path_wins_over_a_type_in_the_body(self, api_key_client, workspace, project, bug_type):
        other = IssueType.objects.create(workspace=workspace, name="Story")
        ProjectIssueType.objects.create(project=project, issue_type=other, workspace=workspace)

        response = api_key_client.post(
            type_property_url(workspace.slug, project.id, bug_type.id),
            {"name": "Severity", "property_type": "TEXT", "issue_type": str(other.id)},
            format="json",
        )

        assert IssueProperty.objects.get(pk=response.data["id"]).issue_type_id == bug_type.id

    @pytest.mark.django_db
    def test_list_returns_the_type_scoped_and_the_unscoped(
        self, api_key_client, workspace, project, bug_type, text_property
    ):
        scoped = IssueProperty.objects.create(
            name="Severity",
            display_name="Severity",
            property_type=PropertyTypeChoices.TEXT,
            project=project,
            workspace=workspace,
            issue_type=bug_type,
        )
        story = IssueType.objects.create(workspace=workspace, name="Story")
        ProjectIssueType.objects.create(project=project, issue_type=story, workspace=workspace)
        IssueProperty.objects.create(
            name="Points",
            display_name="Points",
            property_type=PropertyTypeChoices.DECIMAL,
            project=project,
            workspace=workspace,
            issue_type=story,
        )

        response = api_key_client.get(type_property_url(workspace.slug, project.id, bug_type.id))

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert {str(p["id"]) for p in response.data} == {str(text_property.id), str(scoped.id)}

    @pytest.mark.django_db
    def test_a_property_is_reachable_through_its_type(self, api_key_client, workspace, project, bug_type):
        scoped = IssueProperty.objects.create(
            name="Severity",
            display_name="Severity",
            property_type=PropertyTypeChoices.TEXT,
            project=project,
            workspace=workspace,
            issue_type=bug_type,
        )

        response = api_key_client.get(type_property_url(workspace.slug, project.id, bug_type.id, scoped.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Severity"


@pytest.mark.contract
class TestSinglePropertyValue:
    @pytest.mark.django_db
    def test_unset_property_reports_not_found(self, api_key_client, workspace, project, issue, text_property):
        response = api_key_client.get(value_url(workspace.slug, project.id, issue.id, text_property.id))

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_post_sets_and_returns_the_value(self, api_key_client, workspace, project, issue, text_property):
        response = api_key_client.post(
            value_url(workspace.slug, project.id, issue.id, text_property.id),
            {"value": "ship it"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["value"] == "ship it"
        assert response.data["property_id"] == str(text_property.id)
        assert response.data["issue_id"] == str(issue.id)
        assert response.data["value_type"] == "TEXT"

    @pytest.mark.django_db
    def test_post_replaces_rather_than_duplicates(self, api_key_client, workspace, project, issue, text_property):
        url = value_url(workspace.slug, project.id, issue.id, text_property.id)
        api_key_client.post(url, {"value": "first"}, format="json")
        api_key_client.post(url, {"value": "second"}, format="json")

        assert IssuePropertyValue.objects.filter(issue=issue, property=text_property).count() == 1
        current = api_key_client.get(url)
        assert current.data["value"] == "second"

    @pytest.mark.django_db
    def test_a_multi_select_answers_with_a_list(self, api_key_client, workspace, project, issue, multi_property):
        options = list(multi_property.options.all())

        response = api_key_client.post(
            value_url(workspace.slug, project.id, issue.id, multi_property.id),
            {"value": [str(options[0].id), str(options[1].id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert {row["value"] for row in response.data} == {str(options[0].id), str(options[1].id)}

    @pytest.mark.django_db
    def test_external_ids_survive_a_round_trip(self, api_key_client, workspace, project, issue, text_property):
        url = value_url(workspace.slug, project.id, issue.id, text_property.id)

        api_key_client.post(url, {"value": "x", "external_id": "e-1", "external_source": "jira"}, format="json")

        stored = api_key_client.get(url)
        assert stored.data["external_id"] == "e-1"
        assert stored.data["external_source"] == "jira"

    @pytest.mark.django_db
    def test_patch_refuses_when_nothing_is_set(self, api_key_client, workspace, project, issue, text_property):
        response = api_key_client.patch(
            value_url(workspace.slug, project.id, issue.id, text_property.id),
            {"value": "x"},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_patch_updates_what_is_there(self, api_key_client, workspace, project, issue, text_property):
        url = value_url(workspace.slug, project.id, issue.id, text_property.id)
        api_key_client.post(url, {"value": "before"}, format="json")

        response = api_key_client.patch(url, {"value": "after"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["value"] == "after"

    @pytest.mark.django_db
    def test_delete_clears_the_value(self, api_key_client, workspace, project, issue, text_property):
        url = value_url(workspace.slug, project.id, issue.id, text_property.id)
        api_key_client.post(url, {"value": "x"}, format="json")

        cleared = api_key_client.delete(url)
        assert cleared.status_code == status.HTTP_204_NO_CONTENT
        assert not IssuePropertyValue.objects.filter(issue=issue, property=text_property).exists()

        # A second delete has nothing left to clear.
        again = api_key_client.delete(url)
        assert again.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_a_missing_value_key_is_refused(self, api_key_client, workspace, project, issue, text_property):
        response = api_key_client.post(
            value_url(workspace.slug, project.id, issue.id, text_property.id), {}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_a_value_of_the_wrong_type_is_refused(self, api_key_client, workspace, project, issue):
        number = IssueProperty.objects.create(
            name="Amount",
            display_name="Amount",
            property_type=PropertyTypeChoices.DECIMAL,
            project=project,
            workspace=workspace,
        )

        response = api_key_client.post(
            value_url(workspace.slug, project.id, issue.id, number.id), {"value": "not a number"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_unauthenticated_request_rejected(self, api_client, workspace, project, issue, text_property):
        response = api_client.get(value_url(workspace.slug, project.id, issue.id, text_property.id))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
